import { APIGatewayProxyEvent } from 'aws-lambda';
import { handler } from './index';

const mockGetSignedUrl = jest.fn();

jest.mock('../../../../assets/nodejs/client/s3-client', () => ({
  default: {},
}));

jest.mock('@aws-sdk/s3-request-presigner', () => ({
  getSignedUrl: (...args: unknown[]) => mockGetSignedUrl(...args),
}));

jest.mock('@aws-sdk/client-s3', () => ({
  PutObjectCommand: jest.fn().mockImplementation((input) => ({ input })),
}));

const makeEvent = (overrides: Partial<APIGatewayProxyEvent> = {}): APIGatewayProxyEvent =>
  ({
    headers: {},
    queryStringParameters: null,
    ...overrides,
  } as APIGatewayProxyEvent);

describe('importProductsFile', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.S3_BUCKET_NAME = 'test-bucket';
  });

  it('should return 400 when name query param is missing', async () => {
    const result = await handler(makeEvent());

    expect(result.statusCode).toBe(400);
    expect(JSON.parse(result.body)).toEqual({ message: 'Name query parameter is required' });
  });

  it('should return 500 when S3_BUCKET_NAME env var is not set', async () => {
    delete process.env.S3_BUCKET_NAME;

    const result = await handler(makeEvent({ queryStringParameters: { name: 'products.csv' } }));

    expect(result.statusCode).toBe(500);
    expect(JSON.parse(result.body)).toEqual({ message: 'Internal server error' });
  });

  it('should return 200 with a signed URL on success', async () => {
    const mockUrl = 'https://s3.amazonaws.com/test-bucket/uploaded/products.csv?X-Amz-Signature=abc';
    mockGetSignedUrl.mockResolvedValueOnce(mockUrl);

    const result = await handler(makeEvent({ queryStringParameters: { name: 'products.csv' } }));

    expect(result.statusCode).toBe(200);
    expect(result.body).toBe(mockUrl);
  });

  it('should generate signed URL for the correct key', async () => {
    const mockUrl = 'https://signed-url';
    mockGetSignedUrl.mockResolvedValueOnce(mockUrl);

    await handler(makeEvent({ queryStringParameters: { name: 'my-file.csv' } }));

    const [, command] = mockGetSignedUrl.mock.calls[0];
    expect(command.input).toEqual({
      Bucket: 'test-bucket',
      Key: 'uploaded/my-file.csv',
      ContentType: 'text/csv',
    });
  });

  it('should return 500 when getSignedUrl throws', async () => {
    mockGetSignedUrl.mockRejectedValueOnce(new Error('S3 error'));

    const result = await handler(makeEvent({ queryStringParameters: { name: 'products.csv' } }));

    expect(result.statusCode).toBe(500);
    expect(JSON.parse(result.body)).toEqual({ message: 'Internal server error' });
  });
});
