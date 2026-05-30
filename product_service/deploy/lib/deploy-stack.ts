import * as path from 'path';
import 'dotenv/config';
import * as cdk from 'aws-cdk-lib/core';
import * as sqs from 'aws-cdk-lib/aws-sqs';
import { Construct } from 'constructs';
import { SqsEventSource } from 'aws-cdk-lib/aws-lambda-event-sources';
import { createGetProductsListFunction } from './functions/get-products-list';
import { createGetProductByIdFunction } from './functions/get-product-by-id';
import { createCreateProductFunction } from './functions/create-product';
import { createCatalogBatchProcessFunction } from './functions/catalog-batch-process';
import { createProductsApi } from './api/products-api';
import { createProductTables } from './tables/product-tables';
import { createProductTopic } from './topics/create-product-topic';

import allowedOrigins from '../../../assets/nodejs/helpers/origins';

export class DeployStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const projectRoot = path.resolve(__dirname, '../..');
    const { productsTable, stocksTable } = createProductTables(this);

    const catalogItemsQueue = new sqs.Queue(this, 'CatalogItemsQueue', {
      queueName: 'catalogItemsQueue',
    });

    const productTopic = createProductTopic(this);

    const getProductsListFunction = createGetProductsListFunction(this, {
      projectRoot,
      productsTableName: productsTable.tableName,
      stocksTableName: stocksTable.tableName,
      region: this.region,
    });

    const getProductByIdFunction = createGetProductByIdFunction(this, {
      projectRoot,
      productsTableName: productsTable.tableName,
      stocksTableName: stocksTable.tableName,
      region: this.region,
    });

    const createProductFunction = createCreateProductFunction(this, {
      projectRoot,
      productsTableName: productsTable.tableName,
      stocksTableName: stocksTable.tableName,
      region: this.region,
    });

    const catalogBatchProcessFunction = createCatalogBatchProcessFunction(this, {
      projectRoot,
      productsTableName: productsTable.tableName,
      stocksTableName: stocksTable.tableName,
      createProductTopicArn: productTopic.topicArn,
      region: this.region,
    });

    productsTable.grantReadData(getProductsListFunction);
    stocksTable.grantReadData(getProductsListFunction);

    productsTable.grantReadData(getProductByIdFunction);
    stocksTable.grantReadData(getProductByIdFunction);

    productsTable.grantWriteData(createProductFunction);
    stocksTable.grantWriteData(createProductFunction);

    productsTable.grantWriteData(catalogBatchProcessFunction);
    stocksTable.grantWriteData(catalogBatchProcessFunction);
    catalogItemsQueue.grantConsumeMessages(catalogBatchProcessFunction);
    productTopic.grantPublish(catalogBatchProcessFunction);

    catalogBatchProcessFunction.addEventSource(new SqsEventSource(catalogItemsQueue, {
      batchSize: 5,
    }));

    const api = createProductsApi(this, {
      allowOrigins: allowedOrigins,
      getProductsListFunction,
      getProductByIdFunction,
      createProductFunction,
    });

    new cdk.CfnOutput(this, 'ProductsApiUrl', {
      value: api.url,
    });

    new cdk.CfnOutput(this, 'CatalogItemsQueueName', {
      value: catalogItemsQueue.queueName,
    });

    new cdk.CfnOutput(this, 'CreateProductTopicArn', {
      value: productTopic.topicArn,
    });
  }
}
