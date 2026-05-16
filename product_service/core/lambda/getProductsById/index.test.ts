import { APIGatewayProxyEvent } from 'aws-lambda';
import { handler } from './index';

const mockSend = jest.fn();
jest.mock('../../../../assets/nodejs/client/dynamo-client', () => ({
  dynamoClient: { send: (...args: unknown[]) => mockSend(...args) },
}));

const makeEvent = (overrides: Partial<APIGatewayProxyEvent> = {}): APIGatewayProxyEvent =>
  ({
    headers: {},
    pathParameters: null,
    ...overrides,
  } as APIGatewayProxyEvent);

const mockProduct = { id: '1', title: 'Product 1', description: 'Desc', price: 10 };
const mockStock = { product_id: '1', count: 5 };

describe('getProductsById', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.PRODUCTS_TABLE_NAME = 'Products';
    process.env.STOCKS_TABLE_NAME = 'Stocks';
  });

  it('should return 400 when productId is missing', async () => {
    const result = await handler(makeEvent());

    expect(result.statusCode).toBe(400);
    expect(JSON.parse(result.body)).toEqual({ message: 'Product ID is required' });
  });

  it('should return 404 when product is not found', async () => {
    mockSend
      .mockResolvedValueOnce({ Item: undefined })
      .mockResolvedValueOnce({ Item: undefined });

    const result = await handler(makeEvent({ pathParameters: { productId: 'non-existent-id' } }));

    expect(result.statusCode).toBe(404);
    expect(JSON.parse(result.body)).toEqual({ message: 'Product not found' });
  });

  it('should return the product with stock count when found', async () => {
    mockSend
      .mockResolvedValueOnce({ Item: mockProduct })
      .mockResolvedValueOnce({ Item: mockStock });

    const result = await handler(makeEvent({ pathParameters: { productId: '1' } }));

    expect(result.statusCode).toBe(200);
    expect(JSON.parse(result.body)).toEqual({ ...mockProduct, count: 5 });
  });

  it('should return count 0 when stock is missing', async () => {
    mockSend
      .mockResolvedValueOnce({ Item: mockProduct })
      .mockResolvedValueOnce({ Item: undefined });

    const result = await handler(makeEvent({ pathParameters: { productId: '1' } }));

    expect(result.statusCode).toBe(200);
    expect(JSON.parse(result.body)).toEqual({ ...mockProduct, count: 0 });
  });

  it('should return 500 on DB error', async () => {
    mockSend.mockRejectedValueOnce(new Error('DB connection failed'));

    const result = await handler(makeEvent({ pathParameters: { productId: '1' } }));

    expect(result.statusCode).toBe(500);
    expect(JSON.parse(result.body)).toEqual({ message: 'Internal server error' });
  });

  it('should include CORS headers', async () => {
    mockSend
      .mockResolvedValueOnce({ Item: mockProduct })
      .mockResolvedValueOnce({ Item: mockStock });

    const result = await handler(
      makeEvent({
        headers: { origin: 'http://localhost:3000' },
        pathParameters: { productId: '1' },
      }),
    );

    expect(result.headers?.['Access-Control-Allow-Origin']).toBe('http://localhost:3000');
  });
});
