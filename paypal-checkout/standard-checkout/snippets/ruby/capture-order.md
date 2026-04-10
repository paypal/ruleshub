# Capture Order — Ruby

After the buyer approves the order, **capture** funds (for orders created with `intent: CAPTURE`).

**Server route (example)**: **POST** `/paypal-api/checkout/orders/:order_id/capture`  
**PayPal API**: **POST** `{api_base}/v2/checkout/orders/{order_id}/capture`

---

## PayPal base URLs

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

# Bearer token: PaypalOAuth.access_token — see create-order.md

post "/paypal-api/checkout/orders/:order_id/capture" do
  order_id = params[:order_id]
  conn = Faraday.new(url: paypal_api_base) do |f|
    f.request :json
    f.adapter Faraday.default_adapter
  end

  response = conn.post("/v2/checkout/orders/#{order_id}/capture") do |req|
    req.headers["Authorization"] = "Bearer #{PaypalOAuth.access_token}"
    req.headers["Content-Type"] = "application/json"
    req.headers["Prefer"] = "return=representation"
    req.body = {} # optional body for payment_source, etc.
  end

  unless response.success?
    debug_id = response.headers["paypal-debug-id"]
    halt response.status, json(
      error: "CAPTURE_FAILED",
      paypal_debug_id: debug_id,
      details: JSON.parse(response.body)
    )
  end

  content_type :json
  response.body
end
```

---

## Net::HTTP

```ruby
require "net/http"
require "uri"

uri = URI("#{paypal_api_base}/v2/checkout/orders/#{order_id}/capture")
http = Net::HTTP.new(uri.host, uri.port)
http.use_ssl = true
http.open_timeout = 10
http.read_timeout = 30

req = Net::HTTP::Post.new(uri)
req["Authorization"] = "Bearer #{PaypalOAuth.access_token}"
req["Content-Type"] = "application/json"
req["Prefer"] = "return=representation"
req.body = "{}"

res = http.request(req)
```

Parse `JSON.parse(res.body)` on success; inspect `purchase_units[].payments.captures[]` for `id`, `status`, and `amount`.

---

## Rails

```ruby
# app/services/paypal/capture_order.rb
class Paypal::CaptureOrder
  def self.call(order_id:)
    new(order_id: order_id).call
  end

  def initialize(order_id:)
    @order_id = order_id
  end

  def call
    # Faraday POST .../capture
  end
end
```

---

## Best practices

- Treat capture idempotently: if PayPal returns `ORDER_ALREADY_CAPTURED`, reconcile using **get order** (`get-order-details.md`).
- Persist `capture_id` for refunds and reconciliation.

## Common issues

| Issue | Notes |
|-------|--------|
| Capture on unpaid order | Ensure buyer completed approval; order status must allow capture |
| `INSTRUMENT_DECLINED` | Buyer funding; surface a retry path |
