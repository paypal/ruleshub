# Card Vaulting — Ruby (Sinatra) + Vault API

Save cards for later using PayPal **Vault** APIs and/or JS SDK vault flows. Server calls use the same REST hosts:

| Environment | Base URL |
|-------------|----------|
| Sandbox | `https://api-m.sandbox.paypal.com` |
| Production | `https://api-m.paypal.com` |

The JS SDK handles PCI scope for card entry; your Ruby server exchanges **setup tokens** / **payment tokens** with PayPal using a **server OAuth bearer** (`grant_type=client_credentials`), not the browser client token.

---

## 1) Create setup token (server)

**POST** `/v3/vault/setup-tokens`

```ruby
# frozen_string_literal: true

require "json"
require "faraday"
require "securerandom"

def vault_post(path, body)
  conn = Faraday.new(url: paypal_api_base) do |f|
    f.request :json
    f.adapter Faraday.default_adapter
  end
  conn.post(path) do |req|
    req.headers["Authorization"] = "Bearer #{paypal_access_token}"
    req.headers["Content-Type"] = "application/json"
    req.headers["PayPal-Request-Id"] = SecureRandom.uuid
    req.body = body
  end
end

# Example payload — align fields with current Vault API docs for your use case
def create_setup_token_example
  vault_post(
    "/v3/vault/setup-tokens",
    {
      payment_source: {
        card: {
          experience_context: {
            return_url: "#{ENV.fetch('PUBLIC_BASE_URL')}/vault/return",
            cancel_url: "#{ENV.fetch('PUBLIC_BASE_URL')}/vault/cancel"
          }
        }
      }
    }
  )
end
```

Return the setup token **`id`** (and any approval URL) to the client per the vault flow you implement.

---

## 2) Create payment token (server)

**POST** `/v3/vault/payment-tokens`

```ruby
def create_payment_token_from_setup(setup_token_id)
  vault_post(
    "/v3/vault/payment-tokens",
    {
      payment_source: {
        token: {
          id: setup_token_id,
          type: "SETUP_TOKEN"
        }
      }
    }
  )
end
```

Exact JSON shape follows [Vault API integration](https://docs.paypal.ai/payments/save/api/vault-api-integration).

---

## 3) Charge a vaulted instrument (Orders v2)

Create an order referencing the vaulted payment source per PayPal docs (e.g. **`payment_source.token`** or card vault reference — **verify** the current Orders API schema for your integration). The important rule: keep using **`payment_source`** with proper **`experience_context`** where required, **not** deprecated **`application_context`**.

---

## Sinatra routes (sketch)

```ruby
post "/paypal-api/vault/setup-tokens" do
  res = create_setup_token_example
  halt res.status, res.body
end

post "/paypal-api/vault/payment-tokens" do
  payload = JSON.parse(request.body.read)
  res = create_payment_token_from_setup(payload.fetch("setup_token_id"))
  halt res.status, res.body
end
```

---

## JS SDK (vault with purchase / without purchase)

- With purchase: [Save cards with purchase (v6)](https://docs.paypal.ai/payments/save/sdk/cards/js-sdk-v6-vault)
- Without purchase: [Vault without purchase](https://docs.paypal.ai/payments/save/sdk/cards/js-sdk-v6-vault-no-purchase)

Your Ruby app only needs secure endpoints and OAuth — the SDK collects card data.

---

## Rails notes

- `Paypal::Vault::SetupTokens` and `Paypal::Vault::PaymentTokens` service objects.
- Store `payment_token_id` in your DB associated with the customer profile; encrypt at rest.

## Best practices

- Never log full token values in production logs.
- Use **`PayPal-Request-Id`** for idempotent vault writes.

## Common issues

| Issue | Fix |
|-------|-----|
| 401 on Vault | Use **server** OAuth bearer, not browser `client_token` |
| Validation errors | Match JSON schema to latest Vault API version |
