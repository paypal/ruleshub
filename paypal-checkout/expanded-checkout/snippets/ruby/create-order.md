# Create Order — Expanded Checkout (Ruby + Sinatra)

Server route: **POST** `/paypal-api/checkout/orders/create`  
PayPal API: **POST** `{api_base}/v2/checkout/orders`

Use **Faraday** or **`Net::HTTP`**. Always send the **final amount from your server**. For Expanded Checkout card flows, use **`payment_source.card`** with **`experience_context`** and **`attributes.verification`** — **not** deprecated top-level **`application_context`**.

## REST base URLs

| Environment | Base URL |
|-------------|----------|
| Sandbox | `https://api-m.sandbox.paypal.com` |
| Production | `https://api-m.paypal.com` |

---

## Request body (client → your server)

```json
{ "amount": "50.00", "currency_code": "USD", "funding": "card" }
```

`funding` can distinguish `card` vs `paypal` if you share one route.

---

## Sinatra — Faraday (card + `SCA_WHEN_REQUIRED`)

```ruby
# frozen_string_literal: true

require "sinatra"
require "sinatra/json"
require "json"
require "faraday"
require "securerandom"

def paypal_api_base
  ENV.fetch("PAYPAL_ENVIRONMENT", "sandbox").downcase == "production" \
    ? "https://api-m.paypal.com" \
    : "https://api-m.sandbox.paypal.com"
end

def paypal_access_token
  PaypalOAuth.access_token
end

post "/paypal-api/checkout/orders/create" do
  payload = JSON.parse(request.body.read)
  amount = format("%.2f", payload.fetch("amount").to_f)
  currency = payload.fetch("currency_code", "USD")
  funding = payload.fetch("funding", "card").to_s.downcase

  base_url = request.base_url

  order_payload =
    case funding
    when "paypal"
      {
        intent: "CAPTURE",
        purchase_units: [
          {
            amount: {
              currency_code: currency,
              value: amount
            }
          }
        ],
        payment_source: {
          paypal: {
            experience_context: {
              payment_method_preference: "IMMEDIATE_PAYMENT_REQUIRED",
              shipping_preference: "NO_SHIPPING",
              user_action: "PAY_NOW",
              return_url: "#{base_url}/checkout/return",
              cancel_url: "#{base_url}/checkout/cancel"
            }
          }
        }
      }
    else
      {
        intent: "CAPTURE",
        purchase_units: [
          {
            amount: {
              currency_code: currency,
              value: amount
            }
          }
        ],
        payment_source: {
          card: {
            experience_context: {
              return_url: "#{base_url}/checkout/return",
              cancel_url: "#{base_url}/checkout/cancel"
            },
            attributes: {
              verification: {
                method: "SCA_WHEN_REQUIRED"
              }
            }
          }
        }
      }
    end

  conn = Faraday.new(url: paypal_api_base) do |f|
    f.request :json
    f.adapter Faraday.default_adapter
  end

  request_id = SecureRandom.uuid
  response = conn.post("/v2/checkout/orders") do |req|
    req.headers["Authorization"] = "Bearer #{paypal_access_token}"
    req.headers["Content-Type"] = "application/json"
    req.headers["Prefer"] = "return=representation"
    req.headers["PayPal-Request-Id"] = request_id
    req.body = order_payload
  end

  unless response.success?
    debug_id = response.headers["paypal-debug-id"]
    halt response.status, json(
      error: "ORDER_CREATE_FAILED",
      paypal_debug_id: debug_id,
      details: JSON.parse(response.body)
    )
  end

  status 201
  JSON.parse(response.body).to_json
end
```

Implement **`PaypalOAuth.access_token`** with `grant_type=client_credentials` (server bearer — **distinct** from browser `client_token`). See `client-token-generation.md` for the browser token flow.

---

## Verification methods (3DS)

| Method | Use |
|--------|-----|
| `SCA_WHEN_REQUIRED` | Recommended — 3DS when issuer/regulation requires |
| `SCA_ALWAYS` | Always challenge |

---

## Rails notes

- `OrdersController#create` with strong params; recompute totals server-side.
- Encapsulate payload building in `Paypal::Orders::Create` service object.
- Use `request.base_url` or configured `checkout_return_url` for `experience_context` URLs.

## Best practices

- Idempotency: send **`PayPal-Request-Id`** with a stable UUID per checkout attempt.
- Validate currency and amount before calling PayPal.

## Common issues

| HTTP | Meaning |
|------|---------|
| 401 | Wrong or expired bearer |
| 422 | Validation (amount, currency, payload shape) |
