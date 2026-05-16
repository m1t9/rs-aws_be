import * as path from 'path';
import * as apigateway from "aws-cdk-lib/aws-apigateway";
import * as cdk from 'aws-cdk-lib/core';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import { Construct } from 'constructs';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import { Runtime } from 'aws-cdk-lib/aws-lambda';

import allowedOrigins from '../../../assets/nodejs/helpers/origins';

export class DeployStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const projectRoot = path.resolve(__dirname, '../..');

    const productsTable = new dynamodb.Table(this, 'ProductsTable', {
      tableName: 'products',
      partitionKey: {
        name: 'id',
        type: dynamodb.AttributeType.STRING
      },
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    const stocksTable = new dynamodb.Table(this, 'StocksTable', {
      tableName: 'stocks',
      partitionKey: {
        name: 'product_id',
        type: dynamodb.AttributeType.STRING
      },
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    const getProductsListFunction = new NodejsFunction(this, 'get-products-list', {
      runtime: Runtime.NODEJS_20_X,
      memorySize: 1024,
      timeout: cdk.Duration.seconds(5),
      handler: 'handler',
      entry: path.resolve(__dirname, '../../core/lambda/getProductsList/index.ts'),
      projectRoot,
      environment: {
        PRODUCTS_TABLE_NAME: productsTable.tableName,
        STOCKS_TABLE_NAME: stocksTable.tableName,
        REGION: this.region,
      },
    });

    const getProductByIdFunction = new NodejsFunction(this, 'get-product-by-id', {
      runtime: Runtime.NODEJS_20_X,
      memorySize: 1024,
      timeout: cdk.Duration.seconds(5),
      handler: 'handler',
      entry: path.resolve(__dirname, '../../core/lambda/getProductsById/index.ts'),
      projectRoot,
      environment: {
        PRODUCTS_TABLE_NAME: productsTable.tableName,
        STOCKS_TABLE_NAME: stocksTable.tableName,
        REGION: this.region,
      },
    });

    const createProductFunction = new NodejsFunction(this, 'create-product', {
      runtime: Runtime.NODEJS_20_X,
      memorySize: 1024,
      timeout: cdk.Duration.seconds(5),
      handler: 'handler',
      entry: path.resolve(__dirname, '../../core/lambda/createProduct/index.ts'),
      projectRoot,
      environment: {
        PRODUCTS_TABLE_NAME: productsTable.tableName,
        STOCKS_TABLE_NAME: stocksTable.tableName,
        REGION: this.region,
      },
    });

    productsTable.grantReadData(getProductsListFunction);
    stocksTable.grantReadData(getProductsListFunction);

    productsTable.grantReadData(getProductByIdFunction);
    stocksTable.grantReadData(getProductByIdFunction);

    productsTable.grantWriteData(createProductFunction);
    stocksTable.grantWriteData(createProductFunction);

    const api = new apigateway.RestApi(this, "products-api", {
      restApiName: "Products Service",
      description: "This API serves the Products Lambda functions.",
      deployOptions: {
        stageName: 'development',
      },
      defaultCorsPreflightOptions: {
        allowOrigins: allowedOrigins,
        allowMethods: ['GET', 'POST', 'OPTIONS']
      },
    });

    const getProductsListIntegration = new apigateway.LambdaIntegration(getProductsListFunction);
    const getProductByIdIntegration = new apigateway.LambdaIntegration(getProductByIdFunction);
    const createProductIntegration = new apigateway.LambdaIntegration(createProductFunction);

    const products = api.root.addResource('products');
    products.addMethod('GET', getProductsListIntegration);

    const product = products.addResource('{productId}');
    product.addMethod('GET', getProductByIdIntegration);

    products.addMethod('POST', createProductIntegration);

    new cdk.CfnOutput(this, 'ProductsApiUrl', {
      value: api.url,
    });
  }
}
