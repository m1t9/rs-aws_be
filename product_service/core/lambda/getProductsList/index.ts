import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, ScanCommand } from '@aws-sdk/lib-dynamodb';
import updateHeaders from '../../../../assets/nodejs/helpers/restriction';

const client = DynamoDBDocumentClient.from(new DynamoDBClient({}));

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  console.log('Incoming request: GET /products', { queryStringParameters: event.queryStringParameters, headers: event.headers });

  try {
    const [productsResult, stocksResult] = await Promise.all([
      client.send(new ScanCommand({ TableName: process.env.PRODUCTS_TABLE_NAME })),
      client.send(new ScanCommand({ TableName: process.env.STOCKS_TABLE_NAME })),
    ]);

    console.log(`DB scan complete. Products count: ${productsResult.Items?.length ?? 0}, Stocks count: ${stocksResult.Items?.length ?? 0}`);

    const stocks = stocksResult.Items || [];
    const data = (productsResult.Items || []).map(product => ({
      ...product,
      count: stocks.find(s => s.product_id === product.id)?.count ?? 0,
    }));

    console.log(`Returning ${data.length} products`);

    return {
      statusCode: 200,
      headers: updateHeaders(event.headers),
      body: JSON.stringify(data),
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
