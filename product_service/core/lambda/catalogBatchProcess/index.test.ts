import { SQSEvent } from 'aws-lambda';
import { handler } from './index';

const mockDynamoSend = jest.fn();
const mockSnsSend = jest.fn();

jest.mock('../../../../assets/nodejs/client/dynamo-client', () => ({
  dynamoClient: { send: (...args: unknown[]) => mockDynamoSend(...args) },
}));

jest.mock('@aws-sdk/client-sns', () => ({
  SNSClient: jest.fn().mockImplementation(() => ({
    send: (...args: unknown[]) => mockSnsSend(...args),
  })),
  PublishCommand: jest.fn().mockImplementation((input) => ({ input })),
}));

jest.mock('@aws-sdk/lib-dynamodb', () => ({
  TransactWriteCommand: jest.fn().mockImplementation((input) => ({ input })),
}));

jest.mock('uuid', () => ({
  v4: jest.fn()
    .mockReturnValueOnce('uuid-1')
    .mockReturnValueOnce('uuid-2')
    .mockReturnValue('uuid-default'),
}));

const makeSqsEvent = (bodies: object[]): SQSEvent => ({
  Records: bodies.map((body, index) => ({
    messageId: `msg-${index + 1}`,
    receiptHandle: `rh-${index + 1}`,
    body: JSON.stringify(body),
    attributes: {
      ApproximateReceiveCount: '1',
      SentTimestamp: String(Date.now()),
      SenderId: 'sender',
      ApproximateFirstReceiveTimestamp: String(Date.now()),
    },
    messageAttributes: {},
    md5OfBody: 'md5',
    eventSource: 'aws:sqs',
    eventSourceARN: 'arn:aws:sqs:eu-west-1:123456789012:catalogItemsQueue',
    awsRegion: 'eu-west-1',
  })),
});

describe('catalogBatchProcess', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.PRODUCTS_TABLE_NAME = 'products';
    process.env.STOCKS_TABLE_NAME = 'stocks';
    process.env.CREATE_PRODUCT_TOPIC_ARN = 'arn:aws:sns:eu-west-1:123456789012:createProductTopic';
  });

  it('processes all messages and publishes SNS events', async () => {
    mockDynamoSend.mockResolvedValue({});
    mockSnsSend.mockResolvedValue({});

    const event = makeSqsEvent([
      { title: 'Book', description: 'A', price: 25, count: 2 },
      { title: 'Laptop', description: 'B', price: 1200 },
    ]);

    await handler(event);

    expect(mockDynamoSend).toHaveBeenCalledTimes(2);
    expect(mockSnsSend).toHaveBeenCalledTimes(2);

    const firstDynamoInput = mockDynamoSend.mock.calls[0][0].input;
    expect(firstDynamoInput.TransactItems[0].Put).toMatchObject({
      TableName: 'products',
      Item: { id: 'uuid-1', title: 'Book', description: 'A', price: 25 },
    });
    expect(firstDynamoInput.TransactItems[1].Put).toMatchObject({
      TableName: 'stocks',
      Item: { product_id: 'uuid-1', count: 2 },
    });

    const secondSnsInput = mockSnsSend.mock.calls[1][0].input;
    expect(secondSnsInput.TopicArn).toBe(process.env.CREATE_PRODUCT_TOPIC_ARN);
    expect(secondSnsInput.MessageAttributes).toMatchObject({
      title: { DataType: 'String', StringValue: 'Laptop' },
      price: { DataType: 'Number', StringValue: '1200' },
      count: { DataType: 'Number', StringValue: '0' },
    });
  });

  it('throws when topic arn is missing', async () => {
    delete process.env.CREATE_PRODUCT_TOPIC_ARN;

    await expect(handler(makeSqsEvent([{ title: 'Book', price: 20 }]))).rejects.toThrow(
      'CREATE_PRODUCT_TOPIC_ARN is not configured',
    );

    expect(mockDynamoSend).not.toHaveBeenCalled();
    expect(mockSnsSend).not.toHaveBeenCalled();
  });

  it('throws on invalid payload and does not write/publish', async () => {
    const event = makeSqsEvent([{ title: '', price: 10 }]);

    await expect(handler(event)).rejects.toThrow('Invalid product payload in message msg-1');

    expect(mockDynamoSend).not.toHaveBeenCalled();
    expect(mockSnsSend).not.toHaveBeenCalled();
  });

  it('throws when dynamodb write fails', async () => {
    mockDynamoSend.mockRejectedValueOnce(new Error('Dynamo failed'));

    await expect(handler(makeSqsEvent([{ title: 'Book', price: 10 }]))).rejects.toThrow('Dynamo failed');

    expect(mockDynamoSend).toHaveBeenCalledTimes(1);
    expect(mockSnsSend).not.toHaveBeenCalled();
  });

  it('throws when sns publish fails', async () => {
    mockDynamoSend.mockResolvedValueOnce({});
    mockSnsSend.mockRejectedValueOnce(new Error('SNS failed'));

    await expect(handler(makeSqsEvent([{ title: 'Book', price: 10, count: 1 }]))).rejects.toThrow('SNS failed');

    expect(mockDynamoSend).toHaveBeenCalledTimes(1);
    expect(mockSnsSend).toHaveBeenCalledTimes(1);
  });
});
