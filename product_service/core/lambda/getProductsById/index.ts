import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { GetCommand } from '@aws-sdk/lib-dynamodb';
import updateHeaders from '../../../assets/nodejs/helpers/restriction';
import { client } from '../../../assets/nodejs/client/client';

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  console.log('Incoming request: GET /products/{productId}', { pathParameters: event.pathParameters, headers: event.headers });

  try {
    const { productId } = event.pathParameters || {};

    if (!productId) {
      console.log('Missing productId in path parameters');

      return {
        statusCode: 400,
        headers: updateHeaders(event.headers),
        body: JSON.stringify({ message: 'Product ID is required' }),
      };
    }

    console.log('Fetching product and stock data for productId:', productId);

    const [productResult, stockResult] = await Promise.all([
      client.send(new GetCommand({
        TableName: process.env.PRODUCTS_TABLE_NAME,
        Key: { id: productId },
      })),
      client.send(new GetCommand({
        TableName: process.env.STOCKS_TABLE_NAME,
        Key: { product_id: productId },
      })),
    ]);
    
    if (!productResult.Item) {
      console.log('Product not found for productId:', productId);

      return {
        statusCode: 404,
        headers: updateHeaders(event.headers),
        body: JSON.stringify({ message: 'Product not found' }),
      };
    }

    const product = { ...productResult.Item, count: stockResult.Item?.count ?? 0 };

    console.log('Product found:', product);

    return {
      statusCode: 200,
      headers: updateHeaders(event.headers),
      body: JSON.stringify(product),
    };
  } catch (error) {
    console.error('Error:', error);

    return {
      statusCode: 500,
      headers: updateHeaders(event.headers),
      body: JSON.stringify({ message: 'Internal server error' }),
    };
  }
};
