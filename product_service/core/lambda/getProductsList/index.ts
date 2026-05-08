import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { products } from '../../../assets/nodejs/products/products';
import updateHeaders from '../../../assets/nodejs/helpers/restriction';

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
    return {
        statusCode: 200,
        headers: updateHeaders(event.headers),
        body: JSON.stringify(products),
    };
};
