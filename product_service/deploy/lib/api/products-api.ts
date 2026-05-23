import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import { IFunction } from 'aws-cdk-lib/aws-lambda';
import { Construct } from 'constructs';

type Props = {
  allowOrigins: string[];
  getProductsListFunction: IFunction;
  getProductByIdFunction: IFunction;
  createProductFunction: IFunction;
};

export const createProductsApi = (scope: Construct, props: Props): apigateway.RestApi => {
  const {
    allowOrigins,
    getProductsListFunction,
    getProductByIdFunction,
    createProductFunction,
  } = props;

  const api = new apigateway.RestApi(scope, 'products-api', {
    restApiName: 'Products Service',
    description: 'This API serves the Products Lambda functions.',
    deployOptions: {
      stageName: 'development',
    },
    defaultCorsPreflightOptions: {
      allowOrigins,
      allowMethods: ['GET', 'POST', 'OPTIONS'],
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

  return api;
};
