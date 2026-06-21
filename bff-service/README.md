# BFF Service

A Backend-for-Frontend (BFF) service, built with **pure Node.js** (the built-in
`http` module, no Express), that listens for all incoming requests and proxies
them to the appropriate microservice based on a mapping defined in the `.env`
file.

## How it works

Requests are made to the BFF Service in the following format:

```
{bff-service-url}/{recipient-service-name}?var1=someValue
```

- `{bff-service-url}` — e.g. `http://localhost:3000`
- `{recipient-service-name}` — the first path segment (e.g. `product`, `cart`).
  It is used as a key to look up the `recipientURL` in the `.env` file.
- `?var1=someValue` — the query string, forwarded as-is.

The BFF Service then:

1. Resolves `recipientURL` from the env variables using `{recipient-service-name}` as the key.
2. Reuses the original request `method` (GET, POST, etc.), query string, body and headers.
3. Makes a new request to the recipient service at `recipientURL` (plus any extra path segments).
4. Returns the recipient's response back to the caller.

### Error handling

- If no `recipientURL` is found for `{recipient-service-name}`, the service responds
  with status **502** and body `{ "message": "Cannot process request" }`.
- If the recipient service returns an error, the BFF Service returns the **same status
  code and error payload** the recipient produced.

### Caching

The Product Service `getProductsList` request (`GET {bff}/product/products`) is
cached in memory for **2 minutes**. While the cache is warm, repeated requests
are served from the cache without hitting the Product Service, so a product
created within that window only appears once the cache expires.

To verify:

1. `GET /product/products` — get the products list.
2. `POST /product/products` — create a new product.
3. `GET /product/products` — the new product is **not** in the result (served from cache).
4. Wait more than 2 minutes.
5. `GET /product/products` — the new product **is** in the result (cache expired).

## Setup

```bash
cd bff-service
npm install
cp .env.example .env   # then edit the service URLs
```

Example `.env`:

```
PORT=3000
product=https://your-product-service-url/development
cart=https://your-cart-service-url/api
```

## Scripts

- `npm run start:dev` — run the service in development (ts-node).
- `npm run build` — compile TypeScript to `dist/`.
- `npm start` — run the compiled service.
- `npm test` — run the test suite.
- `npm run lint` — lint the source.

## Example

With `product=https://api.example.com/dev` in `.env`:

```
GET http://localhost:3000/product?count=10
  -> GET https://api.example.com/dev?count=10

GET http://localhost:3000/product/123
  -> GET https://api.example.com/dev/123
```
