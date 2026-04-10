# Prerequisites — PayPal Enterprise Checkout (Node.js + Express + Vanilla JS)

This rulehub assumes **server-side Node.js** with **Express**, the **`braintree`** SDK for Direct, and **axios** for PayPal REST. Enterprise Checkout combines **Braintree Direct** (enterprise card processing, Drop-in UI, Hosted Fields, vault, 3D Secure, fraud tools) with **Multiparty / Platform** (marketplace checkout, seller onboarding, partner fees, Orders API v2). **Agentic Commerce / Store Sync** adds AI-agent-friendly catalog sync, **Cart API**, and checkout completion paths. Use this checklist before you integrate.

## Two pillars + Store Sync

| Pillar | Stack | Use for |
|--------|--------|---------|
| **Braintree Direct** | `braintree` npm, `BraintreeGateway` | Enterprise card processing, vault, fraud tools, Drop-in UI, Hosted Fields |
| **Multiparty / Platform** | `axios` + PayPal REST | Marketplace checkout, seller onboarding, `platform_fees`, `PayPal-Auth-Assertion` |
| **Agentic Commerce / Store Sync** | Cart API + Orders v2 or Braintree | AI agent product discovery, carts, checkout completion |

## Runtime and packages

- **Node.js 18+** (LTS).
- **Package manager:** npm, yarn, or pnpm.

### Typical dependencies

| Package | Purpose |
|---------|---------|
| `express` | API routes: client token, transactions, vault, OAuth, multiparty orders, webhooks |
| `braintree` | `BraintreeGateway`, transactions, customers, webhooks |
| `axios` | PayPal REST (OAuth, partner referrals, orders, cart, webhooks verify) |
| `dotenv` | Load secrets from `.env` |
| `cors` | Allow your checkout origin to call your backend (optional) |

```bash
npm install express braintree axios dotenv cors
```

## Environment variables

Never commit secrets. Use environment variables or a secrets manager.

### Braintree (`BraintreeGateway`)

| Variable | Description |
|----------|-------------|
| `BRAINTREE_MERCHANT_ID` | Merchant ID from Braintree Control Panel |
| `BRAINTREE_PUBLIC_KEY` | Public key |
| `BRAINTREE_PRIVATE_KEY` | Private key — **server only** |
| `BRAINTREE_ENVIRONMENT` | `Sandbox` or `Production` (matches `braintree.Environment`) |

### PayPal REST (multiparty, Cart API, webhooks)

| Variable | Description |
|----------|-------------|
| `PAYPAL_CLIENT_ID` | REST app Client ID from [PayPal Developer Dashboard](https://developer.paypal.com/dashboard/) |
| `PAYPAL_CLIENT_SECRET` | REST secret — **server only** |
| `PAYPAL_ENVIRONMENT` | `sandbox` or `production` (maps to REST base URL) |
| `PAYPAL_PARTNER_MERCHANT_ID` | Platform partner PayPal merchant ID (multiparty flows, Auth-Assertion) |

Optional: `PAYPAL_WEBHOOK_ID` for `POST /v1/notifications/verify-webhook-signature`.

### REST API base URLs

| Environment | Base URL |
|-------------|----------|
| Sandbox | `https://api-m.sandbox.paypal.com` |
| Production | `https://api-m.paypal.com` |

### Braintree environment mapping (server)

```javascript
import braintree from 'braintree';

const braintreeEnvironment =
  process.env.BRAINTREE_ENVIRONMENT === 'Production'
    ? braintree.Environment.Production
    : braintree.Environment.Sandbox;
```

### Example `.env`

```bash
# Braintree
BRAINTREE_MERCHANT_ID=your_merchant_id
BRAINTREE_PUBLIC_KEY=your_public_key
BRAINTREE_PRIVATE_KEY=your_private_key
BRAINTREE_ENVIRONMENT=Sandbox

# PayPal REST
PAYPAL_CLIENT_ID=your_paypal_client_id
PAYPAL_CLIENT_SECRET=your_paypal_client_secret
PAYPAL_ENVIRONMENT=sandbox
PAYPAL_PARTNER_MERCHANT_ID=your_partner_merchant_id

PORT=3000
```

### Map `PAYPAL_ENVIRONMENT` to REST base (server)

```javascript
const PAYPAL_BASE_URL =
  process.env.PAYPAL_ENVIRONMENT === 'production'
    ? 'https://api-m.paypal.com'
    : 'https://api-m.sandbox.paypal.com';
```

## Client scripts (Braintree)

Load the Braintree JS client from Braintree’s CDN (versioned URL per [Braintree client SDK](https://developer.paypal.com/braintree/docs/guides/client-sdk/javascript/v3)). Drop-in and Hosted Fields require `braintree.client` + the relevant component.

## Suggested directory structure

```
project/
├── server/
│   ├── index.js              # Express app
│   ├── braintree-gateway.js  # BraintreeGateway singleton
│   ├── paypal-auth.js        # OAuth token cache for REST
│   └── routes/
│       ├── client-token.js
│       ├── transactions.js
│       ├── multiparty-orders.js
│       └── webhooks.js
├── public/
│   ├── checkout.html
│   └── js/
│       ├── dropin.js
│       └── hosted-fields.js
├── .env
└── package.json
```

## Related snippets

- `braintree-client-token.md` — generate client tokens
- `seller-onboarding.md` — partner referrals and `payments_receivable`
- `multiparty-create-order.md` — orders with `payment_source.paypal.experience_context`
- `agentic-commerce.md` — Cart API and checkout completion
