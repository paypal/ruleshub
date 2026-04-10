# Webhooks — `WebhookNotification.parse`, PayPal verify-webhook-signature

Verify payloads **before** side effects. Respond **200** quickly; queue heavy work.

## Braintree — `WebhookNotification.parse`

Use **raw body** + **`bt-signature`** header. In Sinatra, disable JSON parsing for this route so **`request.body.read`** is untouched.

```ruby
# frozen_string_literal: true

require "sinatra"
require "braintree"

post "/webhooks/braintree" do
  content_type :json
  bt_signature = request.env["HTTP_BT_SIGNATURE"]
  bt_payload = request.body.read

  webhook_notification =
    begin
      braintree_gateway.webhook_notification.parse(bt_signature, bt_payload)
    rescue Braintree::InvalidSignature
      halt 400, { error: "invalid signature" }.to_json
    end

  kind = webhook_notification.kind
  subject = webhook_notification.subject

  case kind
  when "transaction_settled"
    # subject.transaction
  when "transaction_settlement_declined"
  when "dispute_opened"
    # subject.dispute
  when "dispute_lost", "dispute_won"
  when "subscription_charged_successfully", "subscription_charged_unsuccessfully"
  else
    # log unhandled kind
  end

  status 200
  body ""
end
```

Configure the URL and secret in the **Braintree Control Panel** so **`bt-signature`** validates.

## PayPal — `POST /v1/notifications/verify-webhook-signature`

```ruby
# frozen_string_literal: true

require "faraday"
require "json"

post "/webhooks/paypal" do
  request.body.rewind
  raw = request.body.read
  event = JSON.parse(raw)

  access_token = paypal_access_token

  verification = {
    auth_algo: request.env["HTTP_PAYPAL_AUTH_ALGO"],
    cert_url: request.env["HTTP_PAYPAL_CERT_URL"],
    transmission_id: request.env["HTTP_PAYPAL_TRANSMISSION_ID"],
    transmission_sig: request.env["HTTP_PAYPAL_TRANSMISSION_SIG"],
    transmission_time: request.env["HTTP_PAYPAL_TRANSMISSION_TIME"],
    webhook_id: ENV.fetch("PAYPAL_WEBHOOK_ID"),
    webhook_event: event
  }

  conn = Faraday.new(url: paypal_api_base)
  res = conn.post("/v1/notifications/verify-webhook-signature") do |req|
    req.headers["Authorization"] = "Bearer #{access_token}"
    req.headers["Content-Type"] = "application/json"
    req.body = JSON.generate(verification)
  end

  unless res.success?
    halt 500
  end

  data = JSON.parse(res.body)
  unless data["verification_status"] == "SUCCESS"
    halt 400
  end

  case event["event_type"]
  when "PAYMENT.CAPTURE.COMPLETED"
  when "PAYMENT.CAPTURE.DENIED", "PAYMENT.CAPTURE.REFUNDED"
  when "MERCHANT.ONBOARDING.COMPLETED"
  when "CUSTOMER.MERCHANT-INTEGRATION.SELLER-ONBOARDING.STARTED",
       "CUSTOMER.MERCHANT-INTEGRATION.SELLER-ONBOARDING.COMPLETED"
  else
    # log
  end

  status 200
  body ""
end
```

Log **`paypal-debug-id`** on verification failures. Set **`PAYPAL_WEBHOOK_ID`** from the [Developer Dashboard](https://developer.paypal.com/dashboard/).

## Rails notes

- Mount webhook routes with **raw body** access (e.g. **`request.raw_post`** or middleware order) for Braintree signature verification.
- Use **`ActiveJob`** for async processing after returning 200.

## Related snippets

- `seller-onboarding.md` — OAuth for verify call
