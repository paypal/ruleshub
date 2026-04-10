# Error Handling — Expanded Checkout (Ruby + Faraday)

Handle **card declines**, **validation errors**, and **network failures** from PayPal REST. Always log **`paypal-debug-id`** and return **safe** messages to the client.

REST hosts:

| Environment | Base URL |
|-------------|----------|
| Sandbox | `https://api-m.sandbox.paypal.com` |
| Production | `https://api-m.paypal.com` |

See [Card decline errors](https://developer.paypal.com/docs/checkout/advanced/card-decline-errors/) and PayPal troubleshooting docs.

---

## Faraday — parse error body safely

```ruby
# frozen_string_literal: true

require "json"

def paypal_error_payload(response)
  body = response.body.to_s
  data =
    begin
      JSON.parse(body)
    rescue JSON::ParserError
      { "message" => body }
    end
  {
    status: response.status,
    paypal_debug_id: response.headers["paypal-debug-id"],
    name: data["name"],
    message: data["message"],
    details: data["details"],
    raw: data
  }
end
```

---

## Sinatra — create order with structured error

```ruby
post "/paypal-api/checkout/orders/create" do
  # ... build order_payload with payment_source.card (see create-order.md)
  response = faraday_post_orders(order_payload)

  unless response.success?
    err = paypal_error_payload(response)
    logger.error ["paypal_orders_create", err[:paypal_debug_id], err[:name], err[:message]].compact.join(" ")

    halt response.status, json(
      error: "ORDER_CREATE_FAILED",
      code: map_public_error_code(err),
      paypal_debug_id: err[:paypal_debug_id]
    )
  end

  status 201
  response.body
end

def map_public_error_code(err)
  case err[:name]
  when "UNPROCESSABLE_ENTITY" then "UNPROCESSABLE_ENTITY"
  when "RESOURCE_NOT_FOUND" then "NOT_FOUND"
  else "PAYMENT_FAILED"
  end
end
```

---

## Card declines (conceptual)

| Category | Client behavior |
|----------|-----------------|
| Generic decline | Ask user to try another card or PayPal |
| Insufficient funds | User-friendly message |
| Authentication required | Usually handled by 3DS — retry after completion |
| Fraud / risk | Do not retry blindly; follow your risk policy |

Map **issuer response codes** from the capture / payment source object when present — exact fields depend on API response shape.

---

## Faraday exception handling

```ruby
def with_paypal_http
  yield
rescue Faraday::TimeoutError => e
  logger.error ["paypal_timeout", e.message].join(" ")
  [504, { error: "GATEWAY_TIMEOUT" }.to_json]
rescue Faraday::ConnectionFailed => e
  logger.error ["paypal_connection", e.message].join(" ")
  [502, { error: "BAD_GATEWAY" }.to_json]
end
```

---

## Rails — `rescue_from` sketch

```ruby
# app/controllers/concerns/paypal_api_error_handler.rb
rescue_from Faraday::ClientError do |e|
  render json: { error: "paypal_client_error", status: e.response[:status] }, status: :bad_gateway
end
```

Prefer a **service object** that returns `Result` objects instead of raising for expected 4xx from PayPal.

---

## Best practices

- Never expose raw `details` from PayPal to end users in production — log server-side only.
- Correlate logs with **`paypal-debug-id`** for support tickets.
- Retry **only** idempotent operations with the same **`PayPal-Request-Id`** where appropriate.

## Common issues

| Symptom | Check |
|---------|--------|
| Empty `details` | Log full body; some errors are minimal |
| Intermittent 5xx | Exponential backoff + circuit breaker |
