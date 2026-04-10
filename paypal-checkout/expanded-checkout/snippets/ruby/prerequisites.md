# Prerequisites — PayPal Expanded Checkout (Ruby + Sinatra)

Expanded Checkout adds **Card Fields**, **3D Secure**, **Fastlane**, **Apple Pay**, **Google Pay**, and **vaulting** on top of Standard Checkout. Use this checklist before integrating.

## Runtime and gems

- **Ruby 3.1+** (3.2/3.3 recommended).
- **Bundler** for dependency management.

### Typical Gemfile entries

| Gem | Purpose |
|-----|---------|
| `sinatra` | HTTP routes: OAuth, client token, Orders, Vault, webhooks |
| `faraday` | PayPal REST calls (or `Net::HTTP`) |
| `dotenv` | Load `PAYPAL_*` from `.env` in development |
| `puma` or `webrick` | App server |
| `rack-cors` | Allow your checkout origin to call your API (if separate host) |

```ruby
# Gemfile
source "https://rubygems.org"

ruby ">= 3.1.0"

gem "sinatra", "~> 3.0"
gem "sinatra-contrib" # sinatra/json, etc.
gem "faraday"
gem "dotenv"
gem "puma"
gem "rack-cors"
```

```bash
bundle install
```

## Environment variables

Never commit secrets. Use environment variables or a secrets manager.

| Variable | Description |
|----------|-------------|
| `PAYPAL_CLIENT_ID` | REST app Client ID from the [PayPal Developer Dashboard](https://developer.paypal.com/dashboard/) |
| `PAYPAL_CLIENT_SECRET` | REST secret — **server only** |
| `PAYPAL_ENVIRONMENT` | `sandbox` or `production` |
| `PAYPAL_WEBHOOK_ID` | Webhook ID — used with `POST /v1/notifications/verify-webhook-signature` |

### REST API base URLs

| Environment | Base URL |
|-------------|----------|
| Sandbox | `https://api-m.sandbox.paypal.com` |
| Production | `https://api-m.paypal.com` |

### JS SDK v6 script URLs (browser)

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

PORT=4567
```

### Map environment to REST base (server)

```ruby
def paypal_api_base
  ENV.fetch("PAYPAL_ENVIRONMENT", "sandbox").downcase == "production" \
    ? "https://api-m.paypal.com" \
    : "https://api-m.sandbox.paypal.com"
end
```

## Expanded Checkout eligibility

Expanded Checkout requires **merchant eligibility** (countries, currencies, and product availability). Confirm before building:

- [Expanded Checkout eligibility](https://developer.paypal.com/docs/checkout/advanced/eligibility/)

If you only need PayPal-branded buttons without hosted card fields, **Standard Checkout** may be enough.

## Order payloads: `payment_source` (not `application_context`)

Use **`payment_source.paypal.experience_context`** or **`payment_source.card`** with **`experience_context`** / **`attributes`** as required by Orders API v2. Do **not** use deprecated top-level `application_context` for new integrations.

## Suggested layout (Sinatra)

```
project/
├── app.rb                 # routes
├── config.ru
├── Gemfile
├── lib/
│   └── paypal_oauth.rb  # server bearer + optional helpers
├── views/
│   └── checkout.erb       # ERB + SDK script tags
└── public/
    └── checkout.js        # Card Fields / wallet JS — no secrets
```

## Security baseline

- Never expose `PAYPAL_CLIENT_SECRET` or server OAuth tokens to the browser.
- Serve checkout over **HTTPS** in production.
- **Validate amounts, currency, and intent** on the server for every create/capture.
- Card data is handled by PayPal Card Fields — do not collect raw PAN/CVV in custom inputs.

## API endpoints (reference)

| Purpose | Method | Path (relative to `paypal_api_base`) |
|---------|--------|--------------------------------------|
| OAuth (server bearer) | POST | `/v1/oauth2/token` |
| Browser-safe client token (SDK init) | POST | `/v1/oauth2/token` with `response_type=client_token&intent=sdk_init` |
| Create order | POST | `/v2/checkout/orders` |
| Capture order | POST | `/v2/checkout/orders/{id}/capture` |
| Vault setup token | POST | `/v3/vault/setup-tokens` |
| Vault payment token | POST | `/v3/vault/payment-tokens` |
| Verify webhook | POST | `/v1/notifications/verify-webhook-signature` |

## Rails notes

- Add the same gems (or use `faraday` / `httpx` in `Gemfile`).
- Put PayPal config in `config/initializers/paypal.rb` or credentials; use `Rails.application.credentials`.
- Mount a Rack app or use dedicated `Paypal::*` controllers for token, orders, and webhooks.
- For CSRF, webhooks typically use `skip_forgery_protection` on a dedicated route with verification only.

## Common issues

| Issue | Resolution |
|-------|-------------|
| Card Fields do not render | SDK must include `card-fields` (v5 URL or v6 `components`). |
| Sandbox vs live mismatch | Dashboard app mode must match `PAYPAL_ENVIRONMENT` and REST host. |
| Wrong order shape | Use `payment_source` with `experience_context`, not legacy `application_context`. |

## Best practices

- Pin Ruby in `.ruby-version` or `Gemfile`.
- One PayPal app per environment with matching credentials.
- Centralize `paypal_api_base` and SDK URL selection in one module.
- Log **PayPal-Debug-Id** headers on errors for support tickets.
