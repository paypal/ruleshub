# Multiparty capture and refunds — Faraday, Auth-Assertion, platform fee refund

**Capture** an approved order with **`POST /v2/checkout/orders/{order_id}/capture`** and the same **`PayPal-Auth-Assertion`** as create. **Refunds** can include **`payment_instruction.platform_fees`** for the platform fee portion.

**REST bases:** Sandbox `https://api-m.sandbox.paypal.com`, Production `https://api-m.paypal.com`.

## Capture order

```ruby
# frozen_string_literal: true

require "faraday"
require "json"

def capture_multiparty_order(access_token:, order_id:, auth_assertion_jwt:)
  conn = Faraday.new(url: paypal_api_base)
  path = "/v2/checkout/orders/#{URI.encode_www_form_component(order_id)}/capture"

  res = conn.post(path) do |req|
    req.headers["Authorization"] = "Bearer #{access_token}"
    req.headers["Content-Type"] = "application/json"
    req.headers["PayPal-Auth-Assertion"] = auth_assertion_jwt
    req.body = "{}"
  end

  raise "capture #{res.status}: #{res.body}" unless res.success?

  JSON.parse(res.body)
end
```

(`require "uri"` for `URI.encode_www_form_component` or use `CGI.escape` if you prefer.)

Parse **`purchase_units[].payments.captures[]`** and **`seller_receivable_breakdown`** (per Orders API v2) for reconciliation.

## Refund capture with platform fee component

```ruby
def refund_capture_with_platform_fee(
  access_token:,
  capture_id:,
  amount:,
  platform_fee_refund:,
  currency_code: "USD",
  auth_assertion_jwt:
)
  body = {
    amount: {
      currency_code: currency_code,
      value: amount
    },
    payment_instruction: {
      platform_fees: [
        {
          amount: {
            currency_code: currency_code,
            value: platform_fee_refund
          }
        }
      ]
    }
  }

  conn = Faraday.new(url: paypal_api_base)
  path = "/v2/payments/captures/#{URI.encode_www_form_component(capture_id)}/refund"

  res = conn.post(path) do |req|
    req.headers["Authorization"] = "Bearer #{access_token}"
    req.headers["Content-Type"] = "application/json"
    req.headers["PayPal-Auth-Assertion"] = auth_assertion_jwt
    req.body = JSON.generate(body)
  end

  raise "refund #{res.status}: #{res.body}" unless res.success?

  JSON.parse(res.body)
end
```

Align amounts with [multiparty refund rules](https://developer.paypal.com/docs/multiparty/) (currency match, eligible captures).

## Rails notes

- Store **`capture_id`** from the capture response for refunds and support.
- Background reconciliation jobs can poll capture details if needed.

## Related snippets

- `multiparty-create-order.md`
- `error-handling.md`
