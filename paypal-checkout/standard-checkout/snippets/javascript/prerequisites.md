# Prerequisites (JavaScript / Node.js)

Use this checklist before integrating PayPal Standard Checkout with a Node.js backend and browser client.

## Runtime

- **Node.js 18+** (LTS recommended). Native `fetch` and `crypto.randomUUID` are available globally on supported versions; older setups can use `axios` and `node:crypto` explicitly.

## Package managers

- **npm** or **yarn** (or **pnpm**) for installing dependencies.

## Typical dependencies

| Package | Purpose |
|--------|---------|
| `express` | HTTP server and API routes for OAuth, Orders API, webhooks |
| `axios` | HTTP client to PayPal REST APIs (alternative: native `fetch`) |
| `dotenv` | Load `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET`, and environment from `.env` |
| `cors` | Restrict browser origins calling your server (required for local dev and split domains) |

Example install:

```bash
npm install express axios dotenv cors
```

## Environment variables

Never commit secrets. Store credentials in environment variables or a secrets manager.

| Variable | Description |
|----------|-------------|
| `PAYPAL_CLIENT_ID` | REST app client ID from the [PayPal Developer Dashboard](https://developer.paypal.com/dashboard/) |
| `PAYPAL_CLIENT_SECRET` | REST app secret (server-only; never expose to the browser) |
| `PAYPAL_ENVIRONMENT` | `sandbox` or `production` — selects the REST API base URL |

### REST API base URLs

- **Sandbox:** `https://api-m.sandbox.paypal.com`
- **Production:** `https://api-m.paypal.com`

Example `.env`:

```bash
PAYPAL_CLIENT_ID=your_sandbox_or_live_client_id
PAYPAL_CLIENT_SECRET=your_sandbox_or_live_secret
PAYPAL_ENVIRONMENT=sandbox

PORT=3000
# Optional: webhook id from dashboard for signature verification
PAYPAL_WEBHOOK_ID=
```

### Map environment to base URL (server)

```javascript
const PAYPAL_BASE_URL =
  process.env.PAYPAL_ENVIRONMENT === 'production'
    ? 'https://api-m.paypal.com'
    : 'https://api-m.sandbox.paypal.com';
```

## Suggested directory structure

A clear split between server-only code and public assets keeps secrets out of the client bundle.

```
project/
├── server/
│   ├── index.js              # Express app, routes
│   ├── paypal/
│   │   ├── auth.js           # OAuth + browser-safe client token
│   │   ├── orders.js         # create / capture / get order
│   │   ├── webhooks.js       # raw body + verify signature
│   │   └── config.js         # PAYPAL_BASE_URL, env checks
│   └── package.json
├── public/                   # or client/
│   ├── index.html
│   └── checkout.js           # SDK v5/v6 — no secrets
└── .env                      # gitignored
```

## Security baseline

- Keep `PAYPAL_CLIENT_SECRET` only on the server.
- Serve checkout pages over **HTTPS** in production.
- **Validate amounts and currency on the server** before creating or capturing orders.
- Log **PayPal Debug IDs** from API responses and errors for support cases.

## Common issues

| Issue | Resolution |
|-------|------------|
| Wrong API host | Use `api-m.sandbox` vs `api-m` (production) consistently with dashboard app mode. |
| CORS errors | Enable `cors` for your frontend origin; avoid `*` in production if possible. |
| Invalid JSON from your server | Ensure routes return JSON for SDK token/order endpoints; validate `Content-Type` on the client. |

## Best practices

- Pin Node LTS in `engines` or `.nvmrc` for consistent deployments.
- Use one PayPal app per environment (sandbox vs live) with matching credentials.
- Centralize `PAYPAL_BASE_URL` in one module to avoid mixing sandbox and production URLs.
