import * as path from 'path';
import * as cdk from 'aws-cdk-lib/core';
import { Runtime } from 'aws-cdk-lib/aws-lambda';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import { Construct } from 'constructs';

type Props = {
  projectRoot: string;
  productsTableName: string;
  stocksTableName: string;
  region: string;
};

export const createCreateProductFunction = (scope: Construct, props: Props): NodejsFunction => {
  const { projectRoot, productsTableName, stocksTableName, region } = props;

  return new NodejsFunction(scope, 'create-product', {
    runtime: Runtime.NODEJS_20_X,
    memorySize: 1024,
    timeout: cdk.Duration.seconds(5),
    handler: 'handler',
    entry: path.resolve(__dirname, '../../../core/lambda/createProduct/index.ts'),
    projectRoot,
    environment: {
      PRODUCTS_TABLE_NAME: productsTableName,
      STOCKS_TABLE_NAME: stocksTableName,
      REGION: region,
    },
  });
};
