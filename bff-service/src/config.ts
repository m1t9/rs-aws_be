import * as dotenv from 'dotenv';

dotenv.config();

export const PORT = Number(process.env.PORT) || 3000;

export const getRecipientUrl = (recipientServiceName: string): string | undefined => {
  if (!recipientServiceName) {
    return undefined;
  }

  return process.env[recipientServiceName] ?? process.env[recipientServiceName.toUpperCase()];
};
