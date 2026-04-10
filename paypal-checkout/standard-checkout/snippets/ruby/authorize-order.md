# Authorize Order (Delayed Capture) — Ruby

Use **authorize** when you will capture **after** shipment or verification (instead of immediate capture).

**Flow overview**

1. **Create order** with `intent: "AUTHORIZE"` (not `CAPTURE`).
2. Buyer approves in the PayPal flow.
3. **Authorize** the order: **POST** `{api_base}/v2/checkout/orders/{order_id}/authorize`
4. Later, **capture** the authorization: **POST** `{api_base}/v2/payments/authorizations/{authorization_id}/capture`

See also: PayPal docs on [delayed capture](https://docs.paypal.ai/payments/methods/paypal/delayed-capture).

---

## Base URLs

| Environment | Base URL |
|-------------|----------|
| Sandbox | `https://api-m.sandbox.paypal.com` |
| Production | `https://api-m.paypal.com` |

---

## 1. Create order — `intent: AUTHORIZE`

```ruby
order_payload = {
  intent: "AUTHORIZE",
  purchase_units: [
    {
      amount: {
        currency_code: "USD",
        value: "25.00"
      }
    }
  ],
  payment_source: {
    paypal: {
      experience_context: {
        shipping_preference: "NO_SHIPPING",
        return_url: "#{base_url}/checkout/return",
        cancel_url: "#{base_url}/checkout/cancel"
      }
    }
  }
}
# POST /v2/checkout/orders with Bearer token — same as create-order.md but intent AUTHORIZE
```

---

## 2. Authorize — Sinatra (Faraday)

```ruby
# frozen_string_literal: true

require "sinatra/json"
require "json"
require "faraday"

def paypal_api_base
  ENV.fetch("PAYPAL_ENVIRONMENT", "sandbox").downcase == "production" \
    ? "https://api-m.paypal.com" \
    : "https://api-m.sandbox.paypal.com"
end

# Bearer: PaypalOAuth.access_token — see create-order.md

post "/paypal-api/checkout/orders/:order_id/authorize" do
  order_id = params[:order_id]

  conn = Faraday.new(url: paypal_api_base) do |f|
    f.request :json
    f.adapter Faraday.default_adapter
  end

  response = conn.post("/v2/checkout/orders/#{order_id}/authorize") do |req|
    req.headers["Authorization"] = "Bearer #{PaypalOAuth.access_token}"
    req.headers["Content-Type"] = "application/json"
    req.headers["Prefer"] = "return=representation"
    req.body = {}
  end

  unless response.success?
    halt response.status, json(
      error: "AUTHORIZE_FAILED",
      paypal_debug_id: response.headers["paypal-debug-id"],
      details: JSON.parse(response.body)
    )
  end

  body = JSON.parse(response.body)
  # Persist: body.dig("purchase_units", 0, "payments", "authorizations", 0, "id")
  content_type :json
  body.to_json
end
```

---

## 3. Capture authorization later

**POST** `/v2/payments/authorizations/{authorization_id}/capture`

```ruby
# paypal_api_base and PaypalOAuth — same as create-order.md

def capture_authorization(authorization_id, amount_value:, currency_code: "USD")
  conn = Faraday.new(url: paypal_api_base) do |f|
    f.request :json
    f.adapter Faraday.default_adapter
  end

  payload = {
    amount: {
      currency_code: currency_code,
      value: format("%.2f", amount_value.to_f)
    },
    final_capture: true
  }

  conn.post("/v2/payments/authorizations/#{authorization_id}/capture") do |req|
    req.headers["Authorization"] = "Bearer #{PaypalOAuth.access_token}"
    req.headers["Content-Type"] = "application/json"
    req.headers["Prefer"] = "return=representation"
    req.body = payload
  end
end
```

---

## Client SDK (v5 / v6)

- Use the same **create order** server endpoint, but server must send `intent: AUTHORIZE`.
- After approval, call your **`/authorize`** route instead of **`/capture`** on the order (or follow v6 session docs for your integration).

---

## Rails

Encapsulate in `Paypal::Orders::Authorize` and `Paypal::Authorizations::Capture` service objects.

---

## Best practices

- Track authorization **expiry**; reauthorize before expiry if needed (separate API).
- Void unused authorizations when orders cancel.
