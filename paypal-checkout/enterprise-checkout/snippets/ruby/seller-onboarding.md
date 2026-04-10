# Seller onboarding — Faraday `POST /v2/customer/partner-referrals`

Onboard sellers to your platform with **`POST /v2/customer/partner-referrals`**, then poll **`GET /v1/customer/partners/{partner_id}/merchant-integrations/{merchant_id}`** until **`payments_receivable`** and other checks pass.

**REST bases:** Sandbox `https://api-m.sandbox.paypal.com`, Production `https://api-m.paypal.com`.

## OAuth — client credentials

```ruby
# frozen_string_literal: true

require "faraday"
require "json"
require "base64"

def paypal_api_base
  ENV.fetch("PAYPAL_ENVIRONMENT", "sandbox").downcase == "production" \
    ? "https://api-m.paypal.com" \
    : "https://api-m.sandbox.paypal.com"
end

def paypal_access_token
  client_id = ENV.fetch("PAYPAL_CLIENT_ID")
  secret = ENV.fetch("PAYPAL_CLIENT_SECRET")
  basic = Base64.strict_encode64("#{client_id}:#{secret}")

  conn = Faraday.new(url: paypal_api_base) do |f|
    f.request :url_encoded
    f.adapter Faraday.default_adapter
  end

  res = conn.post("/v1/oauth2/token") do |req|
    req.headers["Authorization"] = "Basic #{basic}"
    req.body = { grant_type: "client_credentials" }
  end

  raise "OAuth #{res.status}: #{res.body}" unless res.success?

  JSON.parse(res.body)["access_token"]
end
```

## `POST /v2/customer/partner-referrals`

```ruby
def create_partner_referral(access_token:, tracking_id:, return_url:)
  body = {
    tracking_id: tracking_id,
    partner_config_override: {
      return_url: return_url
    },
    operations: [
      {
        operation: "API_INTEGRATION",
        api_integration_preference: {
          rest_api_integration: {
            integration_method: "PAYPAL",
            integration_type: "THIRD_PARTY",
            third_party_details: {
              features: %w[PAYMENT REFUND PARTNER_FEE]
            }
          }
        }
      }
    ],
    products: ["EXPRESS_CHECKOUT"],
    legal_consents: [
      { type: "SHARE_DATA_CONSENT", granted: true }
    ]
  }

  conn = Faraday.new(url: paypal_api_base)
  res = conn.post("/v2/customer/partner-referrals") do |req|
    req.headers["Authorization"] = "Bearer #{access_token}"
    req.headers["Content-Type"] = "application/json"
    req.body = JSON.generate(body)
  end

  raise "partner-referrals #{res.status}: #{res.body}" unless res.success?

  JSON.parse(res.body)
end
```

Parse **`links`** for **`rel: "action_url"`** and redirect the seller. Use a unique **`tracking_id`** per attempt.

## Check merchant integration status

```ruby
def merchant_integration_status(access_token:, partner_id:, merchant_id:)
  enc_partner = URI.encode_www_form_component(partner_id)
  enc_merchant = URI.encode_www_form_component(merchant_id)
  path = "/v1/customer/partners/#{enc_partner}/merchant-integrations/#{enc_merchant}"

  conn = Faraday.new(url: paypal_api_base)
  res = conn.get(path) do |req|
    req.headers["Authorization"] = "Bearer #{access_token}"
  end

  raise "merchant-integrations #{res.status}: #{res.body}" unless res.success?

  JSON.parse(res.body)
end
```

(`require "uri"` for `URI.encode_www_form_component`.)

Inspect **`payments_receivable`**, **`primary_email_confirmed`**, and **`oauth_integrations`**. Store the seller **`merchant_id`** for **`PayPal-Auth-Assertion`** on orders (`multiparty-create-order.md`).

## Sinatra example

```ruby
post "/api/sellers/onboard" do
  token = paypal_access_token
  data = create_partner_referral(
    access_token: token,
    tracking_id: params["tracking_id"],
    return_url: params["return_url"]
  )
  action = data["links"]&.find { |l| l["rel"] == "action_url" }
  json action_url: action&.dig("href"), raw: data
end
```

## Rails notes

- Store **`tracking_id`** and seller **`merchant_id`** on your **`Seller`** model.
- Trigger status checks from a **controller** or **job** after return URL hit or webhook (`webhooks.md`).

## Related snippets

- `multiparty-create-order.md`
- `webhooks.md`
- `error-handling.md`
