import * as cdk from 'aws-cdk-lib/core';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import { Construct } from 'constructs';

type ProductTables = {
  productsTable: dynamodb.Table;
  stocksTable: dynamodb.Table;
};

export const createProductTables = (scope: Construct): ProductTables => {
  const productsTable = new dynamodb.Table(scope, 'ProductsTable', {
    tableName: 'products',
    partitionKey: {
      name: 'id',
      type: dynamodb.AttributeType.STRING,
    },
    removalPolicy: cdk.RemovalPolicy.DESTROY,
  });

  const stocksTable = new dynamodb.Table(scope, 'StocksTable', {
    tableName: 'stocks',
    partitionKey: {
      name: 'product_id',
      type: dynamodb.AttributeType.STRING,
    },
    removalPolicy: cdk.RemovalPolicy.DESTROY,
  });

  return { productsTable, stocksTable };
};
