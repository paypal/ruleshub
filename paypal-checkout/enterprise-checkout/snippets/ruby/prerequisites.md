# Prerequisites — PayPal Enterprise Checkout (Ruby + Sinatra)

Enterprise Checkout combines **Braintree Direct** (cards, vault, fraud, Drop-in / Hosted Fields) with **Multiparty / Platform** (seller onboarding, platform fees via PayPal REST). **Agentic Commerce / Store Sync** adds Cart API flows. Use this checklist before you integrate.

## Two pillars + Store Sync

| Pillar | Stack | Use for |
|--------|--------|---------|
| **Braintree Direct** | `braintree` gem, `Braintree::Gateway` | Enterprise card processing, vault, fraud tools, Drop-in UI, Hosted Fields |
| **Multiparty / Platform** | **Faraday** + PayPal REST | Marketplace checkout, seller onboarding, `platform_fees`, `PayPal-Auth-Assertion` |
| **Agentic Commerce / Store Sync** | Cart API + Orders v2 or Braintree | AI agent discovery, carts, checkout completion |

## Runtime and gems

- **Ruby 3.1+** (recommended: current stable Ruby).
- **Web framework:** **Sinatra** for lightweight API routes (see **Rails notes** below).

### Typical Gemfile entries

```ruby
source "https://rubygems.org"

ruby ">= 3.1.0"

gem "sinatra", "~> 4.0"
gem "sinatra-contrib" # optional: sinatra/json, etc.
gem "braintree"
gem "faraday"
gem "dotenv"
gem "puma" # or thin/webrick for dev
```

```bash
bundle install
```

## Environment variables

Never commit secrets. Use `.env` (with `dotenv`) or your platform’s secrets manager.

### Braintree (`Braintree::Gateway`)

| Variable | Description |
|----------|-------------|
| `BRAINTREE_MERCHANT_ID` | Merchant ID from Braintree Control Panel |
| `BRAINTREE_PUBLIC_KEY` | Public key |
| `BRAINTREE_PRIVATE_KEY` | Private key — **server only** |
| `BRAINTREE_ENVIRONMENT` | `sandbox` or `production` (maps to Braintree environment) |

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

```ruby
# frozen_string_literal: true

def braintree_environment
  ENV.fetch("BRAINTREE_ENVIRONMENT", "sandbox").downcase == "production" ? :production : :sandbox
end
```

### Example `.env`

```bash
# Braintree
BRAINTREE_MERCHANT_ID=your_merchant_id
BRAINTREE_PUBLIC_KEY=your_public_key
BRAINTREE_PRIVATE_KEY=your_private_key
BRAINTREE_ENVIRONMENT=sandbox

# PayPal REST
PAYPAL_CLIENT_ID=your_paypal_client_id
PAYPAL_CLIENT_SECRET=your_paypal_client_secret
PAYPAL_ENVIRONMENT=sandbox
PAYPAL_PARTNER_MERCHANT_ID=your_partner_merchant_id
PAYPAL_WEBHOOK_ID=your_webhook_id

PORT=4567
```

### Map `PAYPAL_ENVIRONMENT` to REST base (server)

```ruby
def paypal_api_base
  ENV.fetch("PAYPAL_ENVIRONMENT", "sandbox").downcase == "production" \
    ? "https://api-m.paypal.com" \
    : "https://api-m.sandbox.paypal.com"
end
```

## Entry point (Sinatra + dotenv)

```ruby
# frozen_string_literal: true

require "dotenv/load"
require "sinatra"
```

## Client scripts (Braintree)

Load the Braintree JS client from Braintree’s CDN (versioned URL per [Braintree client SDK](https://developer.paypal.com/braintree/docs/guides/client-sdk/javascript/v3)). Drop-in and Hosted Fields require `braintree.client` + the relevant component. Serve ERB/HTML from Sinatra `views/` or static files.

## Suggested directory structure

```
project/
├── app.rb                    # Sinatra app
├── lib/
│   ├── braintree_gateway.rb  # Braintree::Gateway singleton
│   └── paypal_oauth.rb       # OAuth token cache for REST
├── views/
│   └── checkout.erb
├── public/
│   └── js/
├── .env
├── Gemfile
└── config.ru
```

## Rails notes

- Use **`config/credentials`** or **Rails encrypted secrets** instead of plain `.env` in production; load Braintree and PayPal keys in **`config/initializers/braintree.rb`** (or environment-specific initializers).
- Replace Sinatra routes with **`config/routes.rb`** + controller actions; keep the same **Braintree** and **Faraday** call patterns inside service objects (e.g. `app/services/paypal/multiparty_orders.rb`).
- Use **`ActiveSupport::Notifications`** or your logger for PayPal Debug IDs and Braintree transaction IDs.
- For CSRF, use Rails form helpers and **`protect_from_forgery`** on HTML endpoints; API-only routes can use token auth.

## Related snippets

- `braintree-client-token.md` — generate client tokens
- `multiparty-create-order.md` — orders with `payment_source.paypal.experience_context` (**not** `application_context`)
- `agentic-commerce.md` — Cart API and checkout completion
