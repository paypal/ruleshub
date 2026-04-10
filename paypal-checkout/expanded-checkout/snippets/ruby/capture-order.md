# Capture Order — Expanded Checkout (Ruby + Sinatra)

PayPal API: **POST** `{api_base}/v2/checkout/orders/{order_id}/capture`

After the buyer approves (PayPal button) or Card Fields completes authentication, capture the order. For card payments, inspect the capture response for **`liability_shift`** and related fields.

## REST base URLs

| Environment | Base URL |
|-------------|----------|
| Sandbox | `https://api-m.sandbox.paypal.com` |
| Production | `https://api-m.paypal.com` |

---

## Sinatra — Faraday

```ruby
# frozen_string_literal: true

require "sinatra"
require "sinatra/json"
require "json"
require "faraday"

def paypal_api_base
  ENV.fetch("PAYPAL_ENVIRONMENT", "sandbox").downcase == "production" \
    ? "https://api-m.paypal.com" \
    : "https://api-m.sandbox.paypal.com"
end

def paypal_access_token
  PaypalOAuth.access_token
end

post "/paypal-api/checkout/orders/:order_id/capture" do
  order_id = params[:order_id]

  conn = Faraday.new(url: paypal_api_base) do |f|
    f.request :json
    f.adapter Faraday.default_adapter
  end

  response = conn.post("/v2/checkout/orders/#{order_id}/capture") do |req|
    req.headers["Authorization"] = "Bearer #{paypal_access_token}"
    req.headers["Content-Type"] = "application/json"
    req.headers["Prefer"] = "return=representation"
    req.body = {}
  end

  unless response.success?
    debug_id = response.headers["paypal-debug-id"]
    halt response.status, json(
      error: "CAPTURE_FAILED",
      paypal_debug_id: debug_id,
      details: safe_json(response.body)
    )
  end

  body = JSON.parse(response.body)

  # Card / 3DS — inspect payment source on the capture or related purchase_unit
  liability = extract_liability_shift(body)

  status 200
  json body.merge("_meta" => { liability_shift: liability })
rescue JSON::ParserError => e
  status 500
  json error: "INVALID_RESPONSE", message: e.message
end

def safe_json(raw)
  JSON.parse(raw)
rescue JSON::ParserError
  { raw: raw }
end

def extract_liability_shift(capture_body)
  # Structure varies; often under purchase_units[].payments.captures[].payment_source.card.authentication_result
  pu = capture_body["purchase_units"]&.first
  cap = pu&.dig("payments", "captures")&.first
  card = cap&.dig("payment_source", "card")
  card&.dig("authentication_result") || card&.dig("attributes")
end
```

---

## Liability shift (conceptual)

| Signal | Typical meaning |
|--------|-----------------|
| Favorable liability shift | Issuer authenticated; reduced merchant risk in many programs |
| No / unknown liability shift | Review risk settings and PayPal dashboard reporting |

Use PayPal’s documentation for your region and product for exact enum values and reconciliation.

---

## Rails notes

```ruby
# app/controllers/paypal/orders_controller.rb
def capture
  result = Paypal::Orders::Capture.call(order_id: params[:order_id])
  render json: result
end
```

- Run capture in a service; map `payment_source.card.authentication_result` into your fraud/OMS layer.

## Best practices

- Treat capture as **idempotent** at the application level: if already captured, handle duplicate responses per API docs.
- Log **PayPal-Debug-Id** on failures.

## Common issues

| Issue | Fix |
|-------|-----|
| Capture before buyer completes 3DS | Wait for Card Fields / SDK `onApprove` |
| Empty liability data | Inspect full JSON; field paths differ slightly by API version |
