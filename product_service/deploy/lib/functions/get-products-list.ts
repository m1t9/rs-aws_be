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

export const createGetProductsListFunction = (scope: Construct, props: Props): NodejsFunction => {
  const { projectRoot, productsTableName, stocksTableName, region } = props;

  return new NodejsFunction(scope, 'get-products-list', {
    runtime: Runtime.NODEJS_20_X,
    memorySize: 1024,
    timeout: cdk.Duration.seconds(5),
    handler: 'handler',
    entry: path.resolve(__dirname, '../../../core/lambda/getProductsList/index.ts'),
    projectRoot,
    environment: {
      PRODUCTS_TABLE_NAME: productsTableName,
      STOCKS_TABLE_NAME: stocksTableName,
      REGION: region,
    },
  });
};
