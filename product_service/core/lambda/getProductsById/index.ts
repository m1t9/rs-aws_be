import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { products } from '../../../assets/nodejs/products/products';
import updateHeaders from '../../../assets/nodejs/helpers/restriction';

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
    const { productId } = event.pathParameters || {};

    if (!productId) {
        return {
            statusCode: 400,
            headers: updateHeaders(event.headers),
            body: JSON.stringify({ message: 'Product ID is required' }),
        };
    }

    const product = products.find((p) => p.id === productId);
    
    if (!product) {
        return {
            statusCode: 404,
            headers: updateHeaders(event.headers),
            body: JSON.stringify({ message: 'Product not found' }),
        };
    }

    return {
        statusCode: 200,
        headers: updateHeaders(event.headers),
        body: JSON.stringify(product),
    };
};
