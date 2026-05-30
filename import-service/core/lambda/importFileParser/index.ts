import { S3Event } from 'aws-lambda';
import csv from 'csv-parser';
import {
  GetObjectCommand,
  DeleteObjectCommand,
  CopyObjectCommand,
} from '@aws-sdk/client-s3';
import { SendMessageCommand, SQSClient } from '@aws-sdk/client-sqs';

import s3Client from '../../../../assets/nodejs/client/s3-client';

const sqsClient = new SQSClient({ region: process.env.AWS_REGION || 'eu-west-1' });

const parseCsvStream = async (stream: NodeJS.ReadableStream): Promise<void> => {
  const queueUrl = process.env.CATALOG_ITEMS_QUEUE_URL;

  if (!queueUrl) {
    throw new Error('CATALOG_ITEMS_QUEUE_URL is not configured');
  }

  await new Promise<void>((resolve, reject) => {
    const sendTasks: Promise<unknown>[] = [];

    stream
      .pipe(csv())
      .on('data', (data) => {
        const payload = {
          ...data,
          price: Number(data.price),
          count: data.count != null && data.count !== '' ? Number(data.count) : 0,
        };

        sendTasks.push(
          sqsClient.send(new SendMessageCommand({
            QueueUrl: queueUrl,
            MessageBody: JSON.stringify(payload),
          })),
        );
      })
      .on('end', async () => {
        try {
          await Promise.all(sendTasks);
          console.log('CSV parsing completed and rows sent to SQS', { rowsCount: sendTasks.length });
          resolve();
        } catch (error) {
          reject(error);
        }
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
