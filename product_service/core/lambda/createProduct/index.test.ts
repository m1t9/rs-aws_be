import { APIGatewayProxyEvent } from 'aws-lambda';
import { handler } from './index';

const mockSend = jest.fn();
jest.mock('../../../assets/nodejs/client/client', () => ({
  client: { send: (...args: unknown[]) => mockSend(...args) },
}));

jest.mock('uuid', () => ({
  v4: () => 'test-uuid-1234',
}));

const makeEvent = (overrides: Partial<APIGatewayProxyEvent> = {}): APIGatewayProxyEvent =>
  ({
    headers: {},
    pathParameters: null,
    body: null,
    ...overrides,
  } as APIGatewayProxyEvent);

describe('createProduct', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.PRODUCTS_TABLE_NAME = 'Products';
    process.env.STOCKS_TABLE_NAME = 'Stocks';
  });

  it('should return 400 when body is empty', async () => {
    const result = await handler(makeEvent());

    expect(result.statusCode).toBe(400);
  });

  it('should return 400 when title is missing', async () => {
    const result = await handler(makeEvent({ body: JSON.stringify({ price: 10 }) }));

    expect(result.statusCode).toBe(400);
  });

  it('should return 400 when price is missing', async () => {
    const result = await handler(makeEvent({ body: JSON.stringify({ title: 'Test' }) }));

    expect(result.statusCode).toBe(400);
  });

  it('should return 400 when price is not a number', async () => {
    const result = await handler(makeEvent({ body: JSON.stringify({ title: 'Test', price: 'abc' }) }));

    expect(result.statusCode).toBe(400);
  });

  it('should return 400 when price is negative', async () => {
    const result = await handler(makeEvent({ body: JSON.stringify({ title: 'Test', price: -5 }) }));

    expect(result.statusCode).toBe(400);
  });

  it('should return 400 when count is negative', async () => {
    const result = await handler(makeEvent({ body: JSON.stringify({ title: 'Test', price: 10, count: -1 }) }));

    expect(result.statusCode).toBe(400);
  });

  it('should return 400 when count is not a number', async () => {
    const result = await handler(makeEvent({ body: JSON.stringify({ title: 'Test', price: 10, count: 'abc' }) }));

    expect(result.statusCode).toBe(400);
  });

  it('should create product and return 201', async () => {
    mockSend.mockResolvedValueOnce({});

    const result = await handler(makeEvent({
      body: JSON.stringify({ title: 'Test', description: 'Desc', price: 10, count: 5 }),
    }));

    expect(result.statusCode).toBe(201);
    expect(JSON.parse(result.body)).toEqual({
      id: 'test-uuid-1234',
      title: 'Test',
      description: 'Desc',
      price: 10,
      count: 5,
    });
    expect(mockSend).toHaveBeenCalledTimes(1);
  });

  it('should default count to 0 when not provided', async () => {
    mockSend.mockResolvedValueOnce({});

    const result = await handler(makeEvent({
      body: JSON.stringify({ title: 'Test', price: 10 }),
    }));

    expect(result.statusCode).toBe(201);
    const body = JSON.parse(result.body);
    expect(body.count).toBeUndefined();
  });

  it('should return 500 on DB error', async () => {
    mockSend.mockRejectedValueOnce(new Error('TransactionCanceledException'));

    const result = await handler(makeEvent({
      body: JSON.stringify({ title: 'Test', price: 10 }),
    }));

    expect(result.statusCode).toBe(500);
    expect(JSON.parse(result.body)).toEqual({ message: 'Internal server error' });
  });

  it('should include CORS headers on success', async () => {
    mockSend.mockResolvedValueOnce({});

    const result = await handler(makeEvent({
      headers: { origin: 'http://localhost:3000' },
      body: JSON.stringify({ title: 'Test', price: 10 }),
    }));

    expect(result.headers?.['Access-Control-Allow-Origin']).toBe('http://localhost:3000');
  });

  it('should include CORS headers on validation error', async () => {
    const result = await handler(makeEvent({
      headers: { origin: 'http://localhost:3000' },
      body: JSON.stringify({}),
    }));

    expect(result.statusCode).toBe(400);
    expect(result.headers?.['Access-Control-Allow-Origin']).toBe('http://localhost:3000');
  });
});
