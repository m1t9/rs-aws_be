import { S3Event } from 'aws-lambda';
import { Readable } from 'stream';
import { handler } from './index';

const mockS3Send = jest.fn();
const mockSqsSend = jest.fn();

jest.mock('../../../../assets/nodejs/client/s3-client', () => ({
  __esModule: true,
  default: { send: (...args: unknown[]) => mockS3Send(...args) },
}));

jest.mock('@aws-sdk/client-s3', () => ({
  GetObjectCommand: jest.fn().mockImplementation((input) => ({ input })),
  CopyObjectCommand: jest.fn().mockImplementation((input) => ({ input })),
  DeleteObjectCommand: jest.fn().mockImplementation((input) => ({ input })),
}));

jest.mock('@aws-sdk/client-sqs', () => ({
  SQSClient: jest.fn().mockImplementation(() => ({
    send: (...args: unknown[]) => mockSqsSend(...args),
  })),
  SendMessageCommand: jest.fn().mockImplementation((input) => ({ input })),
}));

const makeCsvStream = (rows: string[]): Readable => {
  const csvContent = ['title,price', ...rows].join('\n');
  return Readable.from([csvContent]);
};

const makeS3Event = (bucket: string, key: string): S3Event =>
  ({
    Records: [
      {
        s3: {
          bucket: { name: bucket },
          object: { key },
        },
      },
    ],
  } as unknown as S3Event);

describe('importFileParser', () => {
  beforeEach(() => {
    process.env.CATALOG_ITEMS_QUEUE_URL = 'https://sqs.eu-west-1.amazonaws.com/123456789012/catalogItemsQueue';
    jest.clearAllMocks();
  });

  it('should process a valid CSV file and move it to parsed/', async () => {
    const stream = makeCsvStream(['Product A,10', 'Product B,20']);
    mockS3Send
      .mockResolvedValueOnce({ Body: stream })
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({});
    mockSqsSend.mockResolvedValue({});

    await handler(makeS3Event('my-bucket', 'uploaded/products.csv'));

    expect(mockS3Send).toHaveBeenCalledTimes(3);
    expect(mockSqsSend).toHaveBeenCalledTimes(2);

    const [, copyCall, deleteCall] = mockS3Send.mock.calls;
    expect(copyCall[0].input).toMatchObject({
      Bucket: 'my-bucket',
      CopySource: 'my-bucket/uploaded/products.csv',
      Key: 'parsed/products.csv',
    });
    expect(deleteCall[0].input).toMatchObject({
      Bucket: 'my-bucket',
      Key: 'uploaded/products.csv',
    });

    const [firstMessageCall] = mockSqsSend.mock.calls;
    expect(firstMessageCall[0].input).toMatchObject({
      QueueUrl: process.env.CATALOG_ITEMS_QUEUE_URL,
    });
    expect(JSON.parse(firstMessageCall[0].input.MessageBody)).toMatchObject({
      title: 'Product A',
      price: 10,
      count: 0,
    });
  });

  it('should handle empty Records array without throwing', async () => {
    await handler({ Records: [] } as unknown as S3Event);

    expect(mockS3Send).not.toHaveBeenCalled();
    expect(mockSqsSend).not.toHaveBeenCalled();
  });

  it('should process multiple records', async () => {
    const stream1 = makeCsvStream(['A,1']);
    const stream2 = makeCsvStream(['B,2']);

    mockS3Send
      .mockResolvedValueOnce({ Body: stream1 })
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({ Body: stream2 })
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({});
    mockSqsSend.mockResolvedValue({});

    const event: S3Event = {
      Records: [
        { s3: { bucket: { name: 'bucket' }, object: { key: 'uploaded/file1.csv' } } },
        { s3: { bucket: { name: 'bucket' }, object: { key: 'uploaded/file2.csv' } } },
      ],
    } as unknown as S3Event;

    await handler(event);

    expect(mockS3Send).toHaveBeenCalledTimes(6);
    expect(mockSqsSend).toHaveBeenCalledTimes(2);
  });

  it('should replace only the leading uploaded/ prefix in the key', async () => {
    const stream = makeCsvStream(['A,1']);
    mockS3Send
      .mockResolvedValueOnce({ Body: stream })
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({});
    mockSqsSend.mockResolvedValue({});

    await handler(makeS3Event('bucket', 'uploaded/nested/file.csv'));

    const [, copyCall] = mockS3Send.mock.calls;
    expect(copyCall[0].input.Key).toBe('parsed/nested/file.csv');
  });

  it('should throw when GetObjectCommand fails', async () => {
    mockS3Send.mockRejectedValueOnce(new Error('S3 GetObject error'));

    await expect(handler(makeS3Event('bucket', 'uploaded/file.csv'))).rejects.toThrow('S3 GetObject error');
  });

  it('should throw when CopyObjectCommand fails', async () => {
    const stream = makeCsvStream(['A,1']);
    mockS3Send
      .mockResolvedValueOnce({ Body: stream })
      .mockRejectedValueOnce(new Error('S3 Copy error'));
    mockSqsSend.mockResolvedValue({});

    await expect(handler(makeS3Event('bucket', 'uploaded/file.csv'))).rejects.toThrow('S3 Copy error');
  });

  it('should throw when CATALOG_ITEMS_QUEUE_URL is missing', async () => {
    const stream = makeCsvStream(['A,1']);
    mockS3Send.mockResolvedValueOnce({ Body: stream });
    delete process.env.CATALOG_ITEMS_QUEUE_URL;

    await expect(handler(makeS3Event('bucket', 'uploaded/file.csv'))).rejects.toThrow('CATALOG_ITEMS_QUEUE_URL is not configured');
  });
});
