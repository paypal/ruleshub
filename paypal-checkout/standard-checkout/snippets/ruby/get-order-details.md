# Get Order Details — Ruby

Retrieve an order to **verify status**, amounts, and payer details after approval or for reconciliation.

**PayPal API**: **GET** `{api_base}/v2/checkout/orders/{order_id}`

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

get "/paypal-api/checkout/orders/:order_id" do
  order_id = params[:order_id]

  conn = Faraday.new(url: paypal_api_base) do |f|
    f.adapter Faraday.default_adapter
  end

  response = conn.get("/v2/checkout/orders/#{order_id}") do |req|
    req.headers["Authorization"] = "Bearer #{PaypalOAuth.access_token}"
    req.headers["Content-Type"] = "application/json"
  end

  unless response.success?
    debug_id = response.headers["paypal-debug-id"]
    halt response.status, json(
      error: "GET_ORDER_FAILED",
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

uri = URI("#{paypal_api_base}/v2/checkout/orders/#{order_id}")
http = Net::HTTP.new(uri.host, uri.port)
http.use_ssl = true
http.open_timeout = 10
http.read_timeout = 30

req = Net::HTTP::Get.new(uri)
req["Authorization"] = "Bearer #{PaypalOAuth.access_token}"

res = http.request(req)
```

---

## What to read from the response

- **`status`**: e.g. `CREATED`, `SAVED`, `APPROVED`, `COMPLETED`, `VOIDED`.
- **`purchase_units[].amount`**: compare to your cart before capture.
- **`purchase_units[].payments.captures`**: after capture, capture IDs and statuses.

---

## Rails

```ruby
# config/routes.rb
# get "paypal/orders/:id", to: "paypal/orders#show"

class Paypal::OrdersController < ApplicationController
  def show
    order = Paypal::GetOrder.call(order_id: params[:id])
    render json: order
  end
end
```

---

## Best practices

- Use GET order before capture if you need to re-validate totals after client return.
- Log order ID and status, not full PII, unless your compliance policy allows it.
