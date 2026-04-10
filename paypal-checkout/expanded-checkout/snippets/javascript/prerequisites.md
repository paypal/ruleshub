# Prerequisites — PayPal Expanded (Advanced) Checkout (Node.js + Vanilla JS)

Expanded Checkout layers **custom card fields**, **3D Secure**, **Fastlane**, **Apple Pay**, **Google Pay**, and **card vaulting** on top of Standard Checkout. Use this checklist before you integrate.

## Runtime and packages

- **Node.js 18+** (LTS). Native `fetch` and `crypto.randomUUID` are available; you may still use `axios` for consistency with examples.
- **Package manager:** npm, yarn, or pnpm.

### Typical dependencies

| Package   | Purpose |
|-----------|---------|
| `express` | API routes: OAuth, client token, Orders, Vault, webhooks |
| `axios`   | PayPal REST calls (or native `fetch`) |
| `dotenv`  | Load secrets and `PAYPAL_ENVIRONMENT` from `.env` |
| `cors`    | Allow your checkout origin to call your backend |

```bash
npm install express axios dotenv cors
```

## Environment variables

Never commit secrets. Use environment variables or a secrets manager.

| Variable | Description |
|----------|-------------|
| `PAYPAL_CLIENT_ID` | REST app Client ID from the [PayPal Developer Dashboard](https://developer.paypal.com/dashboard/) |
| `PAYPAL_CLIENT_SECRET` | REST secret — **server only** |
| `PAYPAL_ENVIRONMENT` | `sandbox` or `production` |
| `PAYPAL_WEBHOOK_ID` | Webhook ID from the dashboard — used with `POST /v1/notifications/verify-webhook-signature` |

### REST API base URLs

| Environment | Base URL |
|-------------|----------|
| Sandbox | `https://api-m.sandbox.paypal.com` |
| Production | `https://api-m.paypal.com` |

### JS SDK v6 script URLs

| Environment | URL |
|-------------|-----|
| Sandbox | `https://www.sandbox.paypal.com/web-sdk/v6/core` |
| Production | `https://www.paypal.com/web-sdk/v6/core` |

Example `.env`:

```bash
PAYPAL_CLIENT_ID=your_client_id
PAYPAL_CLIENT_SECRET=your_client_secret
PAYPAL_ENVIRONMENT=sandbox
PAYPAL_WEBHOOK_ID=your_webhook_id

PORT=3000
```

### Map environment to REST base (server)

```javascript
const PAYPAL_BASE_URL =
  process.env.PAYPAL_ENVIRONMENT === 'production'
    ? 'https://api-m.paypal.com'
    : 'https://api-m.sandbox.paypal.com';
```

## Expanded Checkout eligibility

Expanded Checkout requires **merchant eligibility** (countries, currencies, and product availability). Confirm before building:

- [Expanded Checkout eligibility](https://developer.paypal.com/docs/checkout/advanced/eligibility/)

If you only need PayPal-branded buttons without hosted card fields, Standard Checkout may be enough.

## Suggested directory structure

```
project/
├── server/
│   ├── index.js
│   ├── paypal/
│   │   ├── config.js          # PAYPAL_BASE_URL, env validation
│   │   ├── auth.js            # OAuth + browser-safe client token
│   │   ├── orders.js          # create / capture / get order
│   │   ├── vault.js           # setup tokens, payment tokens (optional)
│   │   └── webhooks.js        # raw body + signature verification
│   └── package.json
├── public/
│   ├── index.html
│   └── checkout-expanded.js # SDK v5/v6 — no secrets
└── .env                       # gitignored
```

## Security baseline

- Never expose `PAYPAL_CLIENT_SECRET` or server OAuth tokens to the browser.
- Serve checkout over **HTTPS** in production.
- **Validate amounts, currency, and intent** on the server for every create/capture.
- Card data is handled by PayPal Card Fields — do not collect raw PAN/CVV in your own inputs.

## API endpoints (reference)

| Purpose | Method | Path (relative to `PAYPAL_BASE_URL`) |
|---------|--------|--------------------------------------|
| OAuth (server) | POST | `/v1/oauth2/token` |
| Browser-safe client token (SDK init) | POST | `/v1/oauth2/token` with `response_type=client_token` |
| Create order | POST | `/v2/checkout/orders` |
| Capture order | POST | `/v2/checkout/orders/{id}/capture` |
| Vault setup token | POST | `/v3/vault/setup-tokens` |
| Vault payment token | POST | `/v3/vault/payment-tokens` |
| Verify webhook | POST | `/v1/notifications/verify-webhook-signature` |

Use **`payment_source.paypal.experience_context`** (not deprecated `application_context`) and **`payment_source.card`** for card flows when building order bodies.

## Common issues

| Issue | Resolution |
|-------|------------|
| Card Fields do not render | Ensure SDK loads `card-fields` (v5 `components=buttons,card-fields`; v6 `components: ["paypal-payments", "card-fields"]`). |
| Sandbox vs live mismatch | Dashboard app mode must match `PAYPAL_ENVIRONMENT` and REST host. |
| "Not eligible" for Expanded | Check eligibility; some features are region- or account-specific. |
| CORS on `/paypal-api/*` | Configure `cors` for your frontend origin; avoid `*` in production. |

## Best practices

- Pin Node LTS in `engines` or `.nvmrc`.
- One PayPal app per environment with matching credentials.
- Centralize `PAYPAL_BASE_URL` and SDK URL selection in one module.
- Log **PayPal-Debug-Id** headers on errors for support tickets.
