import { APIGatewayProxyEvent } from 'aws-lambda';
import { handler } from './index';
import { products } from '../../../assets/nodejs/products/products';

const makeEvent = (overrides: Partial<APIGatewayProxyEvent> = {}): APIGatewayProxyEvent =>
  ({
    headers: {},
    pathParameters: null,
    ...overrides,
  } as APIGatewayProxyEvent);

describe('getProductsById', () => {
  it('should return 400 when productId is missing', async () => {
    const result = await handler(makeEvent());

    expect(result.statusCode).toBe(400);
    expect(JSON.parse(result.body)).toEqual({ message: 'Product ID is required' });
  });

  it('should return 404 when product is not found', async () => {
    const result = await handler(makeEvent({ pathParameters: { productId: 'non-existent-id' } }));

    expect(result.statusCode).toBe(404);
    expect(JSON.parse(result.body)).toEqual({ message: 'Product not found' });
  });

  it('should return the product when found', async () => {
    const testProduct = products[0];
    const result = await handler(makeEvent({ pathParameters: { productId: testProduct.id } }));

    expect(result.statusCode).toBe(200);
    expect(JSON.parse(result.body)).toEqual(testProduct);
  });

  it('should include CORS headers', async () => {
    const testProduct = products[0];
    const result = await handler(
      makeEvent({
        headers: { origin: 'http://localhost:3000' },
        pathParameters: { productId: testProduct.id },
      }),
    );

    expect(result.headers?.['Access-Control-Allow-Origin']).toBe('http://localhost:3000');
  });
});
