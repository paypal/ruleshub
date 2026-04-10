# Create Order — Ruby

Server route: **POST** `/paypal-api/checkout/orders/create`  
PayPal API: **POST** `{api_base}/v2/checkout/orders`

Use **Faraday** or **`Net::HTTP`**. Always send the **final amount from your server** (never trust client-only totals for authorization).

---

## Request body (example)

Client may POST:

```json
{ "amount": "10.00", "currency_code": "USD" }
```

Server builds PayPal `purchase_units` and `application_context`.

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
  # Reuse shared OAuth from client-token-generation or a Paypal::OAuth module
  PaypalOAuth.access_token # bearer for REST v2
end

post "/paypal-api/checkout/orders/create" do
  payload = JSON.parse(request.body.read)
  amount = format("%.2f", payload.fetch("amount").to_f)
  currency = payload.fetch("currency_code", "USD")

  order_payload = {
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
          shipping_preference: "NO_SHIPPING",
          user_action: "PAY_NOW",
          return_url: "#{request.base_url}/checkout/return",
          cancel_url: "#{request.base_url}/checkout/cancel"
        }
      }
    }
  }

  conn = Faraday.new(url: paypal_api_base) do |f|
    f.request :json
    f.adapter Faraday.default_adapter
  end

  response = conn.post("/v2/checkout/orders") do |req|
    req.headers["Authorization"] = "Bearer #{paypal_access_token}"
    req.headers["Content-Type"] = "application/json"
    req.headers["Prefer"] = "return=representation"
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

Implement **`PaypalOAuth.access_token`** using `grant_type=client_credentials` (standard app access token, **not** the browser `client_token` flow) for REST `/v2/checkout/orders`.

---

## Minimal OAuth bearer (server) helper

```ruby
# lib/paypal_oauth.rb — app access token for Orders API (distinct from browser client_token)
require "base64"
require "json"
require "faraday"

module PaypalOAuth
  module_function

  @_mutex = Mutex.new
  @_token = nil
  @_expires_at = nil

  def api_base
    ENV.fetch("PAYPAL_ENVIRONMENT", "sandbox").downcase == "production" \
      ? "https://api-m.paypal.com" \
      : "https://api-m.sandbox.paypal.com"
  end

  def basic_auth
    raw = "#{ENV.fetch('PAYPAL_CLIENT_ID')}:#{ENV.fetch('PAYPAL_CLIENT_SECRET')}"
    "Basic #{Base64.strict_encode64(raw)}"
  end

  def access_token
    @_mutex.synchronize do
      now = Time.now.to_f
      if @_token && @_expires_at && now < @_expires_at - 60
        return @_token
      end

      conn = Faraday.new(url: api_base) { |f| f.request :url_encoded; f.adapter Faraday.default_adapter }
      res = conn.post("/v1/oauth2/token") do |req|
        req.headers["Authorization"] = basic_auth
        req.headers["Content-Type"] = "application/x-www-form-urlencoded"
        req.body = { grant_type: "client_credentials" }
      end
      raise "OAuth failed: #{res.status}" unless res.success?

      body = JSON.parse(res.body)
      @_token = body.fetch("access_token")
      @_expires_at = now + body.fetch("expires_in").to_i
      @_token
    end
  end
end
```

---

## Net::HTTP variant (create order)

```ruby
require "net/http"
require "uri"
require "json"

uri = URI("#{paypal_api_base}/v2/checkout/orders")
http = Net::HTTP.new(uri.host, uri.port)
http.use_ssl = true
http.open_timeout = 10
http.read_timeout = 30

req = Net::HTTP::Post.new(uri)
req["Authorization"] = "Bearer #{paypal_access_token}"
req["Content-Type"] = "application/json"
req["Prefer"] = "return=representation"
req.body = JSON.generate(order_payload)

res = http.request(req)
```

---

## Rails

- `OrdersController#create` with strong params for display amount only; recompute line items server-side.
- Put PayPal HTTP in `app/services/paypal/create_order.rb`.

---

## Best practices

- Validate currency and amount ranges before calling PayPal.
- Idempotency: for retries, use `PayPal-Request-Id` header with a stable UUID per logical checkout attempt.

## Common issues

| HTTP | Meaning |
|------|---------|
| 401 | Expired or wrong bearer token |
| 422 | Validation (amount format, currency) |
