import { S3Event } from 'aws-lambda';
import { Readable } from 'stream';
import { handler } from './index';

const mockSend = jest.fn();

jest.mock('../../../../assets/nodejs/client/s3-client', () => ({
  __esModule: true,
  default: { send: (...args: unknown[]) => mockSend(...args) },
}));

jest.mock('@aws-sdk/client-s3', () => ({
  GetObjectCommand: jest.fn().mockImplementation((input) => ({ input })),
  CopyObjectCommand: jest.fn().mockImplementation((input) => ({ input })),
  DeleteObjectCommand: jest.fn().mockImplementation((input) => ({ input })),
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
    jest.clearAllMocks();
  });

  it('should process a valid CSV file and move it to parsed/', async () => {
    const stream = makeCsvStream(['Product A,10', 'Product B,20']);
    mockSend
      .mockResolvedValueOnce({ Body: stream })
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({});

    await handler(makeS3Event('my-bucket', 'uploaded/products.csv'));

    expect(mockSend).toHaveBeenCalledTimes(3);

    const [, copyCall, deleteCall] = mockSend.mock.calls;
    expect(copyCall[0].input).toMatchObject({
      Bucket: 'my-bucket',
      CopySource: 'my-bucket/uploaded/products.csv',
      Key: 'parsed/products.csv',
    });
    expect(deleteCall[0].input).toMatchObject({
      Bucket: 'my-bucket',
      Key: 'uploaded/products.csv',
    });
  });

  it('should handle empty Records array without throwing', async () => {
    await handler({ Records: [] } as unknown as S3Event);

    expect(mockSend).not.toHaveBeenCalled();
  });

  it('should process multiple records', async () => {
    const stream1 = makeCsvStream(['A,1']);
    const stream2 = makeCsvStream(['B,2']);

    mockSend
      .mockResolvedValueOnce({ Body: stream1 })
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({ Body: stream2 })
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({});

    const event: S3Event = {
      Records: [
        { s3: { bucket: { name: 'bucket' }, object: { key: 'uploaded/file1.csv' } } },
        { s3: { bucket: { name: 'bucket' }, object: { key: 'uploaded/file2.csv' } } },
      ],
    } as unknown as S3Event;

    await handler(event);

    expect(mockSend).toHaveBeenCalledTimes(6);
  });

  it('should replace only the leading uploaded/ prefix in the key', async () => {
    const stream = makeCsvStream(['A,1']);
    mockSend
      .mockResolvedValueOnce({ Body: stream })
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({});

    await handler(makeS3Event('bucket', 'uploaded/nested/file.csv'));

    const [, copyCall] = mockSend.mock.calls;
    expect(copyCall[0].input.Key).toBe('parsed/nested/file.csv');
  });

  it('should throw when GetObjectCommand fails', async () => {
    mockSend.mockRejectedValueOnce(new Error('S3 GetObject error'));

    await expect(handler(makeS3Event('bucket', 'uploaded/file.csv'))).rejects.toThrow('S3 GetObject error');
  });

  it('should throw when CopyObjectCommand fails', async () => {
    const stream = makeCsvStream(['A,1']);
    mockSend
      .mockResolvedValueOnce({ Body: stream })
      .mockRejectedValueOnce(new Error('S3 Copy error'));

    await expect(handler(makeS3Event('bucket', 'uploaded/file.csv'))).rejects.toThrow('S3 Copy error');
  });
});
