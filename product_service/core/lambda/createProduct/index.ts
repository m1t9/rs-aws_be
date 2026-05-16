import { TransactWriteCommand } from '@aws-sdk/lib-dynamodb';
import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda/trigger/api-gateway-proxy';
import { v4 as uuidv4 } from 'uuid';
import { dynamoClient } from '../../../../assets/nodejs/client/dynamo-client';
import updateHeaders from '../../../../assets/nodejs/helpers/restriction';

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  console.log('Incoming request: POST /products', { body: event.body, headers: event.headers });

  try {
    const body = JSON.parse(event.body || '{}');
    const { title, description, price, count } = body;

    if (
      !title ||
      typeof title !== 'string' ||
      price == null ||
      typeof price !== 'number' ||
      price < 0 ||
      (count != null && (typeof count !== 'number' || count < 0))
    ) {
      console.log('Validation failed for product data:', { title, description, price, count });

      return {
        statusCode: 400,
        headers: updateHeaders(event.headers),
        body: JSON.stringify({ message: 'Invalid product data: title must be a non-empty string, price must be a non-negative number, count (if provided) must be a non-negative number' }),
      };
    }

    const id = uuidv4();

    console.log('Creating product with id:', id, { title, description, price, count });

    await dynamoClient.send(new TransactWriteCommand({
      TransactItems: [
        { Put: { TableName: process.env.PRODUCTS_TABLE_NAME, Item: { id, title, description, price } } },
        { Put: { TableName: process.env.STOCKS_TABLE_NAME, Item: { product_id: id, count: count ?? 0 } } },
      ],
    }));

    console.log('Product created successfully:', id);

    return {
      statusCode: 201,
      headers: updateHeaders(event.headers),
      body: JSON.stringify({ id, title, description, price, count }),
    };
  } catch (error) {
    console.log('Error:', error);

    return {
      statusCode: 500,
      headers: updateHeaders(event.headers),
      body: JSON.stringify({ message: 'Internal server error' }),
    };
  }
};
