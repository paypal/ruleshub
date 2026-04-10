# Refund Payment — Ruby

Refund a **completed capture** using the capture ID (from capture response or order details).

**PayPal API**: **POST** `{api_base}/v2/payments/captures/{capture_id}/refund`

| Environment | Base URL |
|-------------|----------|
| Sandbox | `https://api-m.sandbox.paypal.com` |
| Production | `https://api-m.paypal.com` |

---

## Request body

- **Full refund**: `{}` or omit amount (verify current API behavior for your version).
- **Partial refund**: include `amount` with `currency_code` and `value`.

```json
{
  "amount": {
    "currency_code": "USD",
    "value": "5.00"
  },
  "note_to_payer": "Partial refund for damaged item"
}
```

---

## Sinatra — Faraday

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

post "/paypal-api/payments/captures/:capture_id/refund" do
  capture_id = params[:capture_id]
  optional = JSON.parse(request.body.read.presence || "{}")

  conn = Faraday.new(url: paypal_api_base) do |f|
    f.request :json
    f.adapter Faraday.default_adapter
  end

  response = conn.post("/v2/payments/captures/#{capture_id}/refund") do |req|
    req.headers["Authorization"] = "Bearer #{PaypalOAuth.access_token}"
    req.headers["Content-Type"] = "application/json"
    req.headers["Prefer"] = "return=representation"
    req.body = optional
  end

  unless response.success?
    halt response.status, json(
      error: "REFUND_FAILED",
      paypal_debug_id: response.headers["paypal-debug-id"],
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
require "json"

uri = URI("#{paypal_api_base}/v2/payments/captures/#{capture_id}/refund")
http = Net::HTTP.new(uri.host, uri.port)
http.use_ssl = true

req = Net::HTTP::Post.new(uri)
req["Authorization"] = "Bearer #{PaypalOAuth.access_token}"
req["Content-Type"] = "application/json"
req.body = JSON.generate(partial_amount_hash) # or "{}"

res = http.request(req)
```

---

## Finding `capture_id`

- From **capture order** response: `purchase_units[0].payments.captures[0].id`
- From **GET order** after capture: same path under `purchase_units[].payments.captures[]`

---

## Rails

```ruby
class Paypal::RefundsController < ApplicationController
  def create
    result = Paypal::RefundCapture.call(
      capture_id: params[:capture_id],
      amount: params.permit(:currency_code, :value)
    )
    render json: result
  end
end
```

---

## Best practices

- Store `capture_id` at checkout completion for later refunds.
- Use idempotency (`PayPal-Request-Id`) for retry-safe refund requests.

## Common issues

| Error | Cause |
|-------|--------|
| `RESOURCE_NOT_FOUND` | Wrong capture ID or environment mismatch |
| `REFUND_EXCEEDED_TRANSACTION_AMOUNT` | Partial refunds exceeding remaining balance |
