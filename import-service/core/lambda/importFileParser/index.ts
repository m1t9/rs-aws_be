import { S3Event } from 'aws-lambda';
import csv from 'csv-parser';
import {
  GetObjectCommand,
  DeleteObjectCommand,
  CopyObjectCommand,
} from '@aws-sdk/client-s3';

import s3Client from '../../../../assets/nodejs/client/s3-client';

const parseCsvStream = async (stream: NodeJS.ReadableStream): Promise<void> => {
  await new Promise<void>((resolve, reject) => {
    stream
      .pipe(csv())
      .on('data', (data) => {
        console.log('Parsed CSV row:', data);
      })
      .on('end', () => {
        console.log('CSV parsing completed');

        resolve();
      })
      .on('error', reject);
  });
};

export const handler = async (event: S3Event): Promise<void> => {
  try {
    const records = event.Records || [];

    console.log('Received S3 event with records:', records);

    for (const record of records) {
      const bucketName = record.s3.bucket.name;
      const objectKey = record.s3.object.key;

      console.log(`Processing file: s3://${bucketName}/${objectKey}`);

      const response = await s3Client.send(new GetObjectCommand({ Bucket: bucketName, Key: objectKey }));

      console.log('File content retrieved successfully:', response);

      const stream = response.Body as NodeJS.ReadableStream;

      await parseCsvStream(stream);

      const parsedKey = objectKey.replace(/^uploaded\//, 'parsed/');
      
      await s3Client.send(new CopyObjectCommand({
        Bucket: bucketName,
        CopySource: `${bucketName}/${objectKey}`,
        Key: parsedKey,
      }));

      await s3Client.send(new DeleteObjectCommand({ Bucket: bucketName, Key: objectKey }));

      console.log(`File processed and moved to s3://${bucketName}/${parsedKey}`);
    }
  } catch (error) {
    console.log('Error:', error);

    throw error;
  }
}
