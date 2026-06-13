import { Buffer } from 'buffer';

type APIGatewayTokenAuthorizerEvent = {
  type: string;
  authorizationToken?: string;
  methodArn: string;
};

type IAMPolicy = {
  principalId: string;
  policyDocument: {
    Version: string;
    Statement: Array<{
      Action: string;
      Effect: string;
      Resource: string;
    }>;
  };
};

const generatePolicy = (principalId: string, resource: string, effect: 'Allow' | 'Deny'): IAMPolicy => ({
  principalId,
  policyDocument: {
    Version: '2012-10-17',
    Statement: [
      {
        Action: 'execute-api:Invoke',
        Effect: effect,
        Resource: resource,
      },
    ],
  },
});

export const handler = async (event: APIGatewayTokenAuthorizerEvent): Promise<IAMPolicy> => {
  console.log('basicAuthorizer event:', JSON.stringify(event));

  const { authorizationToken, methodArn } = event;

  if (!authorizationToken) {
    throw new Error('Unauthorized');
  }

  try {
    const encoded = authorizationToken.replace(/^Basic\s+/i, '');
    const decoded = Buffer.from(encoded, 'base64').toString('utf-8');
    const [username, password] = decoded.split(':');

    const storedPassword = process.env[username];

    if (!storedPassword || storedPassword !== password) {
      return generatePolicy(username || 'anonymous', methodArn, 'Deny');
    }

    return generatePolicy(username, methodArn, 'Allow');
  } catch (error) {
    console.log('Authorization error:', error);

    return generatePolicy('anonymous', methodArn, 'Deny');
  }
};
