import { APIGatewayProxyEvent } from 'aws-lambda';
import { handler } from './index';

const mockSend = jest.fn();
jest.mock('@aws-sdk/client-dynamodb', () => ({
  DynamoDBClient: jest.fn(() => ({})),
}));
jest.mock('@aws-sdk/lib-dynamodb', () => ({
  DynamoDBDocumentClient: { from: jest.fn(() => ({ send: (...args: unknown[]) => mockSend(...args) })) },
  ScanCommand: jest.fn((params: unknown) => params),
}));

const makeEvent = (overrides: Partial<APIGatewayProxyEvent> = {}): APIGatewayProxyEvent =>
  ({
    headers: {},
    pathParameters: null,
    ...overrides,
  } as APIGatewayProxyEvent);

const mockProducts = [
  { id: '1', title: 'Product 1', description: 'Desc 1', price: 10 },
  { id: '2', title: 'Product 2', description: 'Desc 2', price: 20 },
];
const mockStocks = [
  { product_id: '1', count: 5 },
  { product_id: '2', count: 10 },
];

describe('getProductsList', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.PRODUCTS_TABLE_NAME = 'Products';
    process.env.STOCKS_TABLE_NAME = 'Stocks';
  });

  it('should return all products with stock counts and status 200', async () => {
    mockSend
      .mockResolvedValueOnce({ Items: mockProducts })
      .mockResolvedValueOnce({ Items: mockStocks });

    const result = await handler(makeEvent());

    expect(result.statusCode).toBe(200);
    expect(JSON.parse(result.body)).toEqual([
      { id: '1', title: 'Product 1', description: 'Desc 1', price: 10, count: 5 },
      { id: '2', title: 'Product 2', description: 'Desc 2', price: 20, count: 10 },
    ]);
  });

  it('should return count 0 when stock is missing for a product', async () => {
    mockSend
      .mockResolvedValueOnce({ Items: mockProducts })
      .mockResolvedValueOnce({ Items: [{ product_id: '1', count: 5 }] });

    const result = await handler(makeEvent());

    expect(result.statusCode).toBe(200);
    const body = JSON.parse(result.body);
    expect(body[1].count).toBe(0);
  });

  it('should return empty array when no products exist', async () => {
    mockSend
      .mockResolvedValueOnce({ Items: [] })
      .mockResolvedValueOnce({ Items: [] });

    const result = await handler(makeEvent());

    expect(result.statusCode).toBe(200);
    expect(JSON.parse(result.body)).toEqual([]);
  });

  it('should return 500 on DB error', async () => {
    mockSend.mockRejectedValueOnce(new Error('DB connection failed'));

    const result = await handler(makeEvent());

    expect(result.statusCode).toBe(500);
    expect(JSON.parse(result.body)).toEqual({ message: 'Internal server error' });
  });

  it('should include CORS headers when origin is allowed', async () => {
    mockSend
      .mockResolvedValueOnce({ Items: [] })
      .mockResolvedValueOnce({ Items: [] });

    const result = await handler(makeEvent({ headers: { origin: 'http://localhost:3000' } }));

    expect(result.statusCode).toBe(200);
    expect(result.headers?.['Access-Control-Allow-Origin']).toBe('http://localhost:3000');
  });

  it('should not include Allow-Origin header for unknown origins', async () => {
    mockSend
      .mockResolvedValueOnce({ Items: [] })
      .mockResolvedValueOnce({ Items: [] });

    const result = await handler(makeEvent({ headers: { origin: 'https://evil.com' } }));

    expect(result.statusCode).toBe(200);
    expect(result.headers?.['Access-Control-Allow-Origin']).toBeUndefined();
  });
});
