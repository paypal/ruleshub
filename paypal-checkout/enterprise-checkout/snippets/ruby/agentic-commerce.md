# Agentic commerce / Store Sync — Cart API via Faraday

**Store Sync** exposes catalogs for AI agents; **Cart API** manages carts server-side. Reuse **OAuth** (`seller-onboarding.md`) and the same REST **base URLs**: Sandbox `https://api-m.sandbox.paypal.com`, Production `https://api-m.paypal.com`.

## `POST /v2/cart` — create

```ruby
# frozen_string_literal: true

require "faraday"
require "json"
require "securerandom"

def create_cart(access_token:, payload:)
  conn = Faraday.new(url: paypal_api_base)
  res = conn.post("/v2/cart") do |req|
    req.headers["Authorization"] = "Bearer #{access_token}"
    req.headers["Content-Type"] = "application/json"
    req.headers["PayPal-Request-Id"] = SecureRandom.uuid
    req.body = JSON.generate(payload)
  end

  raise "create cart #{res.status}: #{res.body}" unless res.success?

  JSON.parse(res.body)
end
```

Shape **`payload`** per the current [Cart API](https://developer.paypal.com/docs/api/cart/) / [create cart](https://docs.paypal.ai/reference/api/rest/cart-operations/create-cart) reference (items, payee, experience context, etc.).

## `GET /v2/cart/{cart_id}` — details

```ruby
def get_cart(access_token:, cart_id:)
  conn = Faraday.new(url: paypal_api_base)
  path = "/v2/cart/#{URI.encode_www_form_component(cart_id)}"
  res = conn.get(path) do |req|
    req.headers["Authorization"] = "Bearer #{access_token}"
  end
  raise "get cart #{res.status}: #{res.body}" unless res.success?
  JSON.parse(res.body)
end
```

## `PATCH /v2/cart/{cart_id}` — update

```ruby
def patch_cart(access_token:, cart_id:, patch_body:)
  conn = Faraday.new(url: paypal_api_base)
  path = "/v2/cart/#{URI.encode_www_form_component(cart_id)}"
  res = conn.patch(path) do |req|
    req.headers["Authorization"] = "Bearer #{access_token}"
    req.headers["Content-Type"] = "application/json"
    req.headers["PayPal-Request-Id"] = SecureRandom.uuid
    req.body = JSON.generate(patch_body)
  end
  raise "patch cart #{res.status}: #{res.body}" unless res.success?
  JSON.parse(res.body)
end
```

## Checkout completion

1. **Orders v2** — map cart totals to **`POST /v2/checkout/orders`** (`multiparty-create-order.md` for platform fees and **`payment_source.paypal.experience_context`**).
2. **Complete Checkout** — call the [Complete checkout](https://docs.paypal.ai/reference/api/rest/checkout/complete-checkout) endpoint per your approved flow after buyer consent.
3. **Braintree** — if checkout is card/Drop-in: tokenize client-side, then **`gateway.transaction.sale`** (`braintree-transaction.md`).

Keep **one source of truth** for line items and amounts across cart, order, and capture.

## Rails notes

- Idempotent cart updates: rely on **`PayPal-Request-Id`** for retried writes.
- Use **`ActiveJob`** for agent-driven cart creation if latency to PayPal matters.

## Related snippets

- `multiparty-create-order.md`
- `seller-onboarding.md`
