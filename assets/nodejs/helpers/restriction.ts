import allowedOrigins from './origins';

type HeadersInput = {
  origin?: string;
};

type CorsHeaders = {
  'Content-Type': string;
  'Access-Control-Allow-Origin'?: string;
  'Access-Control-Allow-Methods': string;
  'Access-Control-Allow-Headers': string;
};

const updateHeaders = (
  inputHeaders?: HeadersInput
): CorsHeaders => {
  const origin = inputHeaders?.origin;

  const baseHeaders: CorsHeaders = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Methods': 'GET,OPTIONS',
    'Access-Control-Allow-Headers': '*',
  };

  if (origin && allowedOrigins.includes(origin)) {
    return {
      ...baseHeaders,
      'Access-Control-Allow-Origin': origin,
    };
  }

  return baseHeaders;
};

export default updateHeaders;