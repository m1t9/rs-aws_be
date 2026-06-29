import { createServer as createHttpServer, type IncomingMessage, type ServerResponse } from 'http';
import axios, { type Method } from 'axios';

import { getRecipientUrl } from './config';
import { TtlCache } from './cache';

export const productsListCache = new TtlCache();

const PRODUCTS_LIST_SERVICE = 'product';
const PRODUCTS_LIST_PATH = 'products';

const isProductsListRequest = (
  serviceName: string,
  method: string,
  restSegments: string[],
): boolean =>
  method === 'GET' &&
  serviceName === PRODUCTS_LIST_SERVICE &&
  restSegments.length === 1 &&
  restSegments[0] === PRODUCTS_LIST_PATH;

const NON_FORWARDABLE_HEADERS = new Set([
  'host',
  'connection',
  'content-length',
  'transfer-encoding',
  'accept-encoding',
]);

const buildForwardHeaders = (headers: IncomingMessage['headers']): Record<string, string> => {
  const forwarded: Record<string, string> = {};

  for (const [key, value] of Object.entries(headers)) {
    if (value === undefined || NON_FORWARDABLE_HEADERS.has(key.toLowerCase())) {
      continue;
    }

    forwarded[key] = Array.isArray(value) ? value.join(',') : value;
  }

  return forwarded;
};

const readBody = (req: IncomingMessage): Promise<Buffer> =>
  new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];

    req.on('data', (chunk: Buffer) => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });

const sendJson = (res: ServerResponse, statusCode: number, payload: unknown): void => {
  res.writeHead(statusCode, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(payload));
};

export const requestHandler = async (req: IncomingMessage, res: ServerResponse): Promise<void> => {
  try {
    const url = new URL(req.url ?? '/', 'http://localhost');
    const [recipientServiceName, ...restSegments] = url.pathname.split('/').filter(Boolean);

    const recipientUrl = getRecipientUrl(recipientServiceName);

    if (!recipientUrl) {
      sendJson(res, 502, { message: 'Cannot process request' });
      return;
    }

    const restPath = restSegments.length ? `/${restSegments.join('/')}` : '';
    const targetUrl = `${recipientUrl}${restPath}`;

    const method = (req.method ?? 'GET').toUpperCase();
    const hasBody = !['GET', 'HEAD'].includes(method);
    const body = hasBody ? await readBody(req) : undefined;

    const isCacheable = isProductsListRequest(recipientServiceName, method, restSegments);
    const cacheKey = `${targetUrl}${url.search}`;

    if (isCacheable) {
      const cached = productsListCache.get(cacheKey);

      if (cached) {
        sendJson(res, cached.status, cached.data);
        return;
      }
    }

    try {
      const response = await axios.request({
        method: method as Method,
        url: targetUrl,
        params: Object.fromEntries(url.searchParams),
        data: body && body.length > 0 ? body : undefined,
        headers: buildForwardHeaders(req.headers),
      });

      if (isCacheable && response.status >= 200 && response.status < 300) {
        productsListCache.set(cacheKey, { status: response.status, data: response.data });
      }

      sendJson(res, response.status, response.data);
    } catch (error) {
      if (axios.isAxiosError(error) && error.response) {
        sendJson(res, error.response.status, error.response.data);
        return;
      }

      sendJson(res, 502, { message: 'Cannot process request' });
    }
  } catch {
    sendJson(res, 502, { message: 'Cannot process request' });
  }
};

export const createServer = () => createHttpServer(requestHandler);
