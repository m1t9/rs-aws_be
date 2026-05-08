import { APIGatewayProxyEvent } from 'aws-lambda';
import { handler } from './index';
import { products } from '../../../assets/nodejs/products/products';

const makeEvent = (overrides: Partial<APIGatewayProxyEvent> = {}): APIGatewayProxyEvent =>
  ({
    headers: {},
    pathParameters: null,
    ...overrides,
  } as APIGatewayProxyEvent);

describe('getProductsList', () => {
  it('should return all products with status 200', async () => {
    const result = await handler(makeEvent());

    expect(result.statusCode).toBe(200);
    expect(JSON.parse(result.body)).toEqual(products);
  });

  it('should include CORS headers when origin is allowed', async () => {
    const result = await handler(makeEvent({ headers: { origin: 'http://localhost:3000' } }));

    expect(result.statusCode).toBe(200);
    expect(result.headers?.['Access-Control-Allow-Origin']).toBe('http://localhost:3000');
  });

  it('should not include Allow-Origin header for unknown origins', async () => {
    const result = await handler(makeEvent({ headers: { origin: 'https://evil.com' } }));

    expect(result.statusCode).toBe(200);
    expect(result.headers?.['Access-Control-Allow-Origin']).toBeUndefined();
  });
});
