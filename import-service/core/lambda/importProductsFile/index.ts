import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

import updateHeaders from '../../../../assets/nodejs/helpers/restriction';
import s3Client from '../../../../assets/nodejs/client/s3-client';

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  console.log('Incoming request: GET /products', { body: event.body, headers: event.headers });
  
  try {
    const { name } = event.queryStringParameters || {};

    if (!name) {
      console.log('Missing name in query parameters');

      return {
        statusCode: 400,
        headers: updateHeaders(event.headers),
        body: JSON.stringify({ message: 'Name query parameter is required' }),
      };
    }

    const bucketName = process.env.S3_BUCKET_NAME;
    if (!bucketName) {
      throw new Error('S3_BUCKET_NAME environment variable is not set');
    }

    const key = `uploaded/${name}`;

    const command = new PutObjectCommand({
      Bucket: bucketName,
      Key: key,
      ContentType: 'text/csv',
    });

    const signedUrl = await getSignedUrl(s3Client, command, {
      expiresIn: 300,
    });

    return {
      statusCode: 200,
      headers: updateHeaders(event.headers),
      body: signedUrl
    }
  } catch (error) {
    console.log('Error:', error);

    return {
      statusCode: 500,
      headers: updateHeaders(event.headers),
      body: JSON.stringify({ message: 'Internal server error' }),
    };
  }
}
