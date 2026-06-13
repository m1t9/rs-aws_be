import * as path from 'path';
import * as fs from 'fs';
import * as cdk from 'aws-cdk-lib/core';
import * as iam from 'aws-cdk-lib/aws-iam';
import { Construct } from 'constructs';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import { Runtime } from 'aws-cdk-lib/aws-lambda';
import * as dotenv from 'dotenv';

export class AuthorizationServiceStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const projectRoot = path.resolve(__dirname, '../..');

    const basicAuthorizerFunction = new NodejsFunction(this, 'basic-authorizer', {
      runtime: Runtime.NODEJS_20_X,
      memorySize: 1024,
      timeout: cdk.Duration.seconds(5),
      handler: 'handler',
      entry: path.resolve(__dirname, '../../core/lambda/basicAuthorizer/index.ts'),
      projectRoot,
      environment: dotenv.parse(fs.readFileSync(path.resolve(__dirname, '../.env'))),
    });

    basicAuthorizerFunction.addPermission('ApiGatewayInvoke', {
      principal: new iam.ServicePrincipal('apigateway.amazonaws.com'),
      action: 'lambda:InvokeFunction',
      sourceArn: `arn:aws:execute-api:${this.region}:${this.account}:*`,
    });

    new cdk.CfnOutput(this, 'BasicAuthorizerArn', {
      value: basicAuthorizerFunction.functionArn,
      exportName: 'BasicAuthorizerArn',
    });
  }
}
