# Error handling — Braintree `result.success?`, processor codes, Faraday errors

Log **Braintree transaction ids**, **processor codes**, and PayPal **`paypal-debug-id`** for support.

## Braintree

### Success check

```ruby
result = braintree_gateway.transaction.sale(
  amount: "10.00",
  payment_method_nonce: nonce
)

if result.success?
  # use result.transaction
else
  # see below
end
```

### Processor declines (typical codes 2000–2999)

- Read **`processor_response_code`** and **`processor_response_text`** on **`result.transaction`** when present.
- Map to **buyer-safe** messages; avoid echoing raw issuer text if it may leak sensitive data.

### `gateway_rejected`

- Inspect **`gateway_rejection_reason`** (risk, AVS/CVV policy).
- Log **`transaction.id`** when available.

### Validation errors

```ruby
unless result.success?
  if result.respond_to?(:errors) && result.errors.any?
    result.errors.each { |e| warn "#{e.attribute}: #{e.message}" }
  end
end
```

Use **`deep_errors`** where the Ruby SDK exposes it for nested validations (`customer.create`, etc.).

## Multiparty / PayPal REST (Faraday)

```ruby
# frozen_string_literal: true

res = conn.post("/v2/checkout/orders") do |req|
  req.headers["Authorization"] = "Bearer #{access_token}"
  req.headers["Content-Type"] = "application/json"
  req.body = JSON.generate(order_payload)
end

unless res.success?
  debug_id = res.headers["paypal-debug-id"]
  body = JSON.parse(res.body) rescue res.body
  warn "PayPal #{res.status} debug_id=#{debug_id} body=#{body}"
end
```

### Common cases

- **401** — refresh OAuth; verify **`PAYPAL_CLIENT_ID`** / **`PAYPAL_CLIENT_SECRET`** and sandbox vs production **`paypal_api_base`**.
- **403** — scopes or partner permissions; confirm app is enabled for multiparty.
- **Seller not ready** — **`payments_receivable`** false (`seller-onboarding.md`).
- **Platform fee errors** — currency mismatch or fee vs. total rules; read **`details`** in error JSON (**422** unprocessable entity).

### Faraday connection errors

```ruby
begin
  res = conn.post("/v2/checkout/orders") { |req| req.body = "{}" }
rescue Faraday::TimeoutError, Faraday::ConnectionFailed => e
  warn "PayPal transport: #{e.class}: #{e.message}"
  raise
end
```

## Client vs server messaging

- **Server** decides retryability; **client** shows a generic failure plus an internal reference id when appropriate.

## Related snippets

- `braintree-transaction.md`
- `multiparty-create-order.md`
