import * as sns from 'aws-cdk-lib/aws-sns';
import * as subscriptions from 'aws-cdk-lib/aws-sns-subscriptions';
import { Construct } from 'constructs';

export const createProductTopic = (scope: Construct): sns.Topic => {
  const standardProductsEmail = process.env.STANDARD_PRODUCTS_EMAIL;
  const premiumProductsEmail = process.env.PREMIUM_PRODUCTS_EMAIL;

  if (!standardProductsEmail || !premiumProductsEmail) {
    throw new Error('STANDARD_PRODUCTS_EMAIL and PREMIUM_PRODUCTS_EMAIL must be set');
  }

  const topic = new sns.Topic(scope, 'CreateProductTopic', {
    topicName: 'createProductTopic',
    displayName: 'Create Product Notifications',
  });

  topic.addSubscription(new subscriptions.EmailSubscription(standardProductsEmail, {
    filterPolicy: {
      price: sns.SubscriptionFilter.numericFilter({ lessThan: 100 }),
    },
  }));

  topic.addSubscription(new subscriptions.EmailSubscription(premiumProductsEmail, {
    filterPolicy: {
      price: sns.SubscriptionFilter.numericFilter({ greaterThanOrEqualTo: 100 }),
    },
  }));

  return topic;
};
