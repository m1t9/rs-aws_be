import { PutCommand } from '@aws-sdk/lib-dynamodb';
import { v4 as uuidv4 } from 'uuid';
import { products } from '../products/products';
import { docClient } from '../client/dynamo-client';

async function fillTables() {
  const productsList = products.map((product) => ({
    ...product,
    id: uuidv4()
  }));

  for (const product of productsList) {
    await docClient.send(new PutCommand({
      TableName: 'products',
      Item: product,
    }));

    await docClient.send(new PutCommand({
      TableName: 'stocks',
      Item: { product_id: product.id, count: Math.floor(Math.random() * 10) + 1 },
    }));
  }
}

fillTables();
