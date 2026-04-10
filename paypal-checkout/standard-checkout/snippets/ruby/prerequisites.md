# Prerequisites — Ruby (PayPal Standard Checkout)

Runtime requirements, gems, environment variables, and a suggested layout for **Sinatra** (primary) or **Rails** Standard Checkout integrations.

## Runtime

- **Ruby**: 3.1 or newer (3.3+ recommended).
- **Bundler**: for dependency management (`gem install bundler`).

## Dependencies

Create a `Gemfile`:

```ruby
# frozen_string_literal: true

source "https://rubygems.org"

ruby ">= 3.1.0"

gem "sinatra", "~> 4.0"
gem "sinatra-contrib" # JSON helpers, etc.
gem "puma"            # production server
gem "faraday", "~> 2.0" # HTTP client (recommended)
gem "dotenv", groups: %i[development test]
gem "json"            # stdlib; explicit for documentation
```

**Alternative**: use only `net/http` from the standard library (no Faraday). The snippets show both where it matters.

Install:

```bash
bundle install
```

| Gem | Purpose |
|-----|---------|
| `sinatra` | Lightweight app, routes, JSON |
| `faraday` | PayPal REST calls with timeouts, middleware |
| `dotenv` | Load `.env` in development (never commit secrets) |
| `json` | Parse/stringify JSON bodies (stdlib; often already loaded) |

### Optional — Rails

For Rails, add the same HTTP stack or use `faraday` / `net/http` in a service object; `dotenv-rails` for local env loading.

## Environment variables

Never log secret values. Validate at boot in production.

| Variable | Required | Description |
|----------|----------|-------------|
| `PAYPAL_CLIENT_ID` | Yes | REST app Client ID (PayPal Developer Dashboard) |
| `PAYPAL_CLIENT_SECRET` | Yes | REST app secret |
| `PAYPAL_ENVIRONMENT` | Yes | `sandbox` or `production` (selects API base URL) |
| `PAYPAL_WEBHOOK_ID` | For webhooks | Webhook ID from dashboard (verification) |

Example `.env` (local only; gitignore):

```env
PAYPAL_CLIENT_ID=your_sandbox_client_id
PAYPAL_CLIENT_SECRET=your_sandbox_secret
PAYPAL_ENVIRONMENT=sandbox
PAYPAL_WEBHOOK_ID=your_webhook_id
```

## PayPal REST API base URLs

Server-to-server calls use the **api-m** host:

| Environment | Base URL |
|-------------|----------|
| Sandbox | `https://api-m.sandbox.paypal.com` |
| Production | `https://api-m.paypal.com` |

```ruby
# config/paypal.rb or lib/paypal_env.rb
module PaypalEnv
  module_function

  def api_base
    ENV.fetch("PAYPAL_ENVIRONMENT", "sandbox").downcase == "production" \
      ? "https://api-m.paypal.com" \
      : "https://api-m.sandbox.paypal.com"
  end
end
```

## Suggested directory structure (Sinatra)

```
your_app/
├── .env                 # local only
├── Gemfile
├── Gemfile.lock
├── config.ru
├── app.rb               # or split: routes/, lib/
├── views/
│   └── checkout.erb     # ERB + PayPal JS SDK
└── public/              # optional static assets
```

Minimal `config.ru`:

```ruby
# frozen_string_literal: true

require_relative "app"
run Sinatra::Application
```

## Security checklist

- Keep `PAYPAL_CLIENT_SECRET` only on the server.
- Use HTTPS in production for token, order, and webhook routes.
- Restrict CORS to known origins if the checkout origin differs.

## Common issues

| Issue | Cause | Fix |
|-------|--------|-----|
| `401 INVALID_CLIENT` | Wrong credentials or wrong `api-m` environment | Match dashboard app (sandbox vs live) |
| TLS errors | Old Ruby/OpenSSL | Use supported Ruby; update CA certs on host |
| Env vars missing in prod | Relying on `.env` only | Use platform secret manager |

## Best practices

- Fail fast at startup if required env vars are absent.
- Centralize `api_base` and OAuth in one module shared by all snippets.
- Pin gem versions in `Gemfile` for reproducible deploys.
