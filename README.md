# rs-aws_be

This repository represents the backend part of the **NodejsAWSShopReact** application.

## Overview

The backend is built with **Node.js** and deployed to **AWS** using the **AWS CDK**. It exposes a set of RESTful API endpoints via **API Gateway** backed by **Lambda** functions.

## Project Structure

- **product_service/** — Product Service microservice
  - `assets/nodejs/` — Shared helpers (CORS, allowed origins) and product data
  - `core/lambda/` — Lambda handlers
    - `getProductsList/` — Returns the full list of products
    - `getProductsById/` — Returns a single product by ID
  - `deploy/` — AWS CDK infrastructure stack
  - `openapi.json` — OpenAPI specification

## Getting Started

### Install dependencies

```bash
cd <service_name> && npm install
cd <service_name>/deploy && npm install
```

### Run tests

```bash
cd <service_name> && npm test
```

### Deploy

```bash
cd <service_name>/deploy && npx cdk deploy
```

> Replace `<service_name>` with the target service directory (e.g. `product_service`).

