# Multiparty create order — Faraday `POST /v2/checkout/orders`, `platform_fees`, `experience_context`

Create a **PayPal** order where the **seller** is the payee and the **platform** takes a fee. Use **`payment_source.paypal.experience_context`** for return/cancel URLs, locale, brand, and UX. **Do not** use deprecated **`application_context`** for new integrations.

Use **`PayPal-Auth-Assertion`** (JWT) so PayPal knows the partner is acting for the seller.

**REST bases:** Sandbox `https://api-m.sandbox.paypal.com`, Production `https://api-m.paypal.com`.

Reuse **`paypal_api_base`** and **`paypal_access_token`** from `seller-onboarding.md`.

## Build `PayPal-Auth-Assertion` (header value)

The value is a **signed JWT** with claims including **`iss`** = partner REST **client_id** and **`payer_id`** = **seller merchant id**. Generate per [Multiparty documentation](https://developer.paypal.com/docs/multiparty/).

```text
PayPal-Auth-Assertion: eyJhbGciOi...<JWT>...
```

## `POST /v2/checkout/orders` — Faraday

```ruby
# frozen_string_literal: true

require "faraday"
require "json"

def create_multiparty_order(
  access_token:,
  seller_merchant_id:,
  platform_fee_value:,
  purchase_total_value:,
  currency_code:,
  auth_assertion_jwt:,
  return_url:,
  cancel_url:
)
  body = {
    intent: "CAPTURE",
    purchase_units: [
      {
        reference_id: "default",
        amount: {
          currency_code: currency_code,
          value: purchase_total_value,
          breakdown: {
            item_total: {
              currency_code: currency_code,
              value: purchase_total_value
            }
          }
        },
        payee: { merchant_id: seller_merchant_id },
        payment_instruction: {
          platform_fees: [
            {
              amount: {
                currency_code: currency_code,
                value: platform_fee_value
              }
            }
          ]
        }
      }
    ],
    payment_source: {
      paypal: {
        experience_context: {
          payment_method_preference: "IMMEDIATE_PAYMENT_REQUIRED",
          brand_name: "My Marketplace",
          locale: "en-US",
          landing_page: "LOGIN",
          user_action: "PAY_NOW",
          return_url: return_url,
          cancel_url: cancel_url,
          shipping_preference: "GET_FROM_FILE"
        }
      }
    }
  }

  conn = Faraday.new(url: paypal_api_base)
  res = conn.post("/v2/checkout/orders") do |req|
    req.headers["Authorization"] = "Bearer #{access_token}"
    req.headers["Content-Type"] = "application/json"
    req.headers["PayPal-Auth-Assertion"] = auth_assertion_jwt
    req.headers["PayPal-Partner-Attribution-Id"] = ENV["PAYPAL_BN_CODE"].to_s
    req.body = JSON.generate(body)
  end

  raise "create order #{res.status}: #{res.body}" unless res.success?

  JSON.parse(res.body)
end
```

## Important

- **`purchase_units[].payee.merchant_id`**: connected seller merchant id.
- **`payment_instruction.platform_fees`**: platform cut; fee currency must match the transaction currency.
- **`payment_source.paypal.experience_context`**: checkout UX (not legacy **`application_context`**).
- **`PayPal-Auth-Assertion`**: required for partner-initiated seller transactions per multiparty docs.

Approve with the JS SDK using the returned order **`id`**, then **capture** on the server (`multiparty-capture.md`).

## Rails notes

- Wrap the Faraday call in a service (e.g. `Paypal::Multiparty::CreateOrder`).
- Store **`id`** (order id) and align amounts with your marketplace order record.

## Related snippets

- `seller-onboarding.md`
- `multiparty-capture.md`
- `error-handling.md`
