import * as path from 'path';
import * as cdk from 'aws-cdk-lib/core';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as apigateway from "aws-cdk-lib/aws-apigateway";
import * as s3Notifications from 'aws-cdk-lib/aws-s3-notifications';
import * as sqs from 'aws-cdk-lib/aws-sqs';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import { Construct } from 'constructs';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import { Runtime } from 'aws-cdk-lib/aws-lambda';

export class ImportServiceStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const projectRoot = path.resolve(__dirname, '../..');
    const catalogItemsQueueName = 'catalogItemsQueue';

    const catalogItemsQueue = sqs.Queue.fromQueueArn(
      this,
      'CatalogItemsQueue',
      `arn:aws:sqs:${this.region}:${this.account}:${catalogItemsQueueName}`,
    );

    const bucket = new s3.Bucket(this, 'ImportBucket', {
      bucketName: `import-bucket-${this.account}-${this.region}`,
      cors: [
        {
          allowedMethods: [s3.HttpMethods.GET, s3.HttpMethods.PUT],
          allowedOrigins: ['*'],
          allowedHeaders: ['*'],
        },
      ],
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
    });

    const importProductsFileFn = new NodejsFunction(this, 'import-products-file', {
      runtime: Runtime.NODEJS_20_X,
      memorySize: 1024,
      timeout: cdk.Duration.seconds(5),
      handler: 'index.handler',
      entry: path.resolve(__dirname, '../../core/lambda/importProductsFile/index.ts'),
      projectRoot,
      environment: {
        REGION: this.region,
        S3_BUCKET_NAME: bucket.bucketName,
      },
    });

    const importFileParserFn = new NodejsFunction(this, 'import-file-parser', {
      runtime: Runtime.NODEJS_20_X,
      memorySize: 1024,
      timeout: cdk.Duration.seconds(5),
      handler: 'index.handler',
      entry: path.resolve(__dirname, '../../core/lambda/importFileParser/index.ts'),
      projectRoot,
      environment: {
        REGION: this.region,
        S3_BUCKET_NAME: bucket.bucketName,
        CATALOG_ITEMS_QUEUE_URL: `https://sqs.${this.region}.${cdk.Aws.URL_SUFFIX}/${this.account}/${catalogItemsQueueName}`,
      },
    });

    bucket.grantReadWrite(importProductsFileFn);
    bucket.grantReadWrite(importFileParserFn);
    catalogItemsQueue.grantSendMessages(importFileParserFn);

    bucket.addEventNotification(
      s3.EventType.OBJECT_CREATED,
      new s3Notifications.LambdaDestination(importFileParserFn),
      { prefix: 'uploaded/' }
    );

    const api = new apigateway.RestApi(this, 'import-api', {
      restApiName: 'Import Service',
      description: 'This API serves the Import Lambda functions.',
      deployOptions: {
        stageName: 'development',
      },
      defaultCorsPreflightOptions: {
        allowOrigins: apigateway.Cors.ALL_ORIGINS,
        allowMethods: apigateway.Cors.ALL_METHODS,
        allowHeaders: ['Content-Type', 'Authorization'],
      },
    });

    api.addGatewayResponse('UnauthorizedGatewayResponse', {
      type: apigateway.ResponseType.UNAUTHORIZED,
      responseHeaders: {
        'Access-Control-Allow-Origin': "'*'",
        'Access-Control-Allow-Headers': "'Content-Type,Authorization'",
      },
    });

    api.addGatewayResponse('ForbiddenGatewayResponse', {
      type: apigateway.ResponseType.ACCESS_DENIED,
      responseHeaders: {
        'Access-Control-Allow-Origin': "'*'",
        'Access-Control-Allow-Headers': "'Content-Type,Authorization'",
      },
    });

    const basicAuthorizerArn = cdk.Fn.importValue('BasicAuthorizerArn');

    const basicAuthorizerFn = lambda.Function.fromFunctionArn(
      this,
      'BasicAuthorizer',
      basicAuthorizerArn,
    );

    const authorizer = new apigateway.TokenAuthorizer(this, 'ImportAuthorizer', {
      handler: basicAuthorizerFn,
      identitySource: 'method.request.header.Authorization',
    });

    const importProductsFileIntegration = new apigateway.LambdaIntegration(importProductsFileFn);

    const importProducts = api.root.addResource('import');
    importProducts.addMethod('GET', importProductsFileIntegration, {
      authorizer,
      authorizationType: apigateway.AuthorizationType.CUSTOM,
    });

    new cdk.CfnOutput(this, 'ImportApiUrl', {
      value: api.url,
    });
  }
}
