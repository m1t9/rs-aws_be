#!/usr/bin/env node
import 'dotenv/config';
import * as cdk from 'aws-cdk-lib/core';
import { DeployStack } from '../lib/deploy-stack';

const app = new cdk.App();
new DeployStack(app, 'DeployStack', {});
