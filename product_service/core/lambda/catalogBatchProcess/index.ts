import { SQSEvent } from 'aws-lambda';
import { TransactWriteCommand } from '@aws-sdk/lib-dynamodb';
import { PublishCommand, SNSClient } from '@aws-sdk/client-sns';
import { v4 as uuidv4 } from 'uuid';
import { dynamoClient } from '../../../../assets/nodejs/client/dynamo-client';

const snsClient = new SNSClient({ region: process.env.AWS_REGION || 'eu-west-1' });

type CatalogItem = {
  title: string;
  description?: string;
  price: number;
  count?: number;
};

const isValidCatalogItem = (item: CatalogItem): boolean => (
  !!item.title
  && typeof item.title === 'string'
  && typeof item.price === 'number'
  && item.price >= 0
  && (item.count == null || (typeof item.count === 'number' && item.count >= 0))
);

export const handler = async (event: SQSEvent): Promise<void> => {
  console.log('Incoming SQS batch for catalog items', { recordsCount: event.Records.length });

  const topicArn = process.env.CREATE_PRODUCT_TOPIC_ARN;

  if (!topicArn) {
    throw new Error('CREATE_PRODUCT_TOPIC_ARN is not configured');
  }

  for (const record of event.Records) {
    try {
      const payload = JSON.parse(record.body) as CatalogItem;

      if (!isValidCatalogItem(payload)) {
        throw new Error(`Invalid product payload in message ${record.messageId}`);
      }

      const id = uuidv4();
      const { title, description, price, count } = payload;

      await dynamoClient.send(new TransactWriteCommand({
        TransactItems: [
          {
            Put: {
              TableName: process.env.PRODUCTS_TABLE_NAME,
              Item: { id, title, description, price },
            },
          },
          {
            Put: {
              TableName: process.env.STOCKS_TABLE_NAME,
              Item: { product_id: id, count: count ?? 0 },
            },
          },
        ],
      }));

      await snsClient.send(new PublishCommand({
        TopicArn: topicArn,
        Subject: 'Product created',
        Message: JSON.stringify({
          id,
          title,
          description,
          price,
          count: count ?? 0,
        }),
        MessageAttributes: {
          title: {
            DataType: 'String',
            StringValue: title,
          },
          price: {
            DataType: 'Number',
            StringValue: String(price),
          },
          count: {
            DataType: 'Number',
            StringValue: String(count ?? 0),
          },
        },
      }));

      console.log('Catalog item processed', { messageId: record.messageId, productId: id });
    } catch (error) {
      console.log('Failed to process SQS message', { messageId: record.messageId, error });
      throw error;
    }
  }
};
