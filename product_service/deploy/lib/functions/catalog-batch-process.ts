import * as path from 'path';
import * as cdk from 'aws-cdk-lib/core';
import { Runtime } from 'aws-cdk-lib/aws-lambda';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import { Construct } from 'constructs';

type Props = {
  projectRoot: string;
  productsTableName: string;
  stocksTableName: string;
  createProductTopicArn: string;
  region: string;
};

export const createCatalogBatchProcessFunction = (scope: Construct, props: Props): NodejsFunction => {
  const { projectRoot, productsTableName, stocksTableName, createProductTopicArn, region } = props;

  return new NodejsFunction(scope, 'catalog-batch-process', {
    runtime: Runtime.NODEJS_20_X,
    memorySize: 1024,
    timeout: cdk.Duration.seconds(10),
    handler: 'handler',
    entry: path.resolve(__dirname, '../../../core/lambda/catalogBatchProcess/index.ts'),
    projectRoot,
    environment: {
      PRODUCTS_TABLE_NAME: productsTableName,
      STOCKS_TABLE_NAME: stocksTableName,
      CREATE_PRODUCT_TOPIC_ARN: createProductTopicArn,
      REGION: region,
    },
  });
};
