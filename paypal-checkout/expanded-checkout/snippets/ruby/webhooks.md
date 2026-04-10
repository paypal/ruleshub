# Webhooks — Ruby (Sinatra) — Expanded Checkout

Receive PayPal **webhook notifications** on a public HTTPS URL, verify signatures, then process events **idempotently**.

**Verification API**: **POST** `{api_base}/v1/notifications/verify-webhook-signature`

| Environment | Base URL |
|-------------|----------|
| Sandbox | `https://api-m.sandbox.paypal.com` |
| Production | `https://api-m.paypal.com` |

Set **`PAYPAL_WEBHOOK_ID`** from the Developer Dashboard for the webhook you create.

---

## Sinatra — listener + verification (Faraday)

```ruby
# frozen_string_literal: true

require "sinatra"
require "sinatra/json"
require "json"
require "faraday"

post "/webhooks/paypal" do
  raw_body = request.body.read
  webhook_event = JSON.parse(raw_body)

  unless verify_paypal_webhook_signature!(request, raw_body, webhook_event)
    halt 401, json(error: "INVALID_SIGNATURE")
  end

  event_type = webhook_event["event_type"]
  resource = webhook_event["resource"]

  case event_type
  when "PAYMENT.CAPTURE.COMPLETED"
    handle_capture_completed(resource)
  when "PAYMENT.CAPTURE.DENIED"
    handle_capture_denied(resource)
  when "CHECKOUT.ORDER.APPROVED"
    handle_order_approved(resource)
  else
    logger.info ["paypal_webhook_ignored", event_type].join(" ")
  end

  status 200
  json received: true
rescue JSON::ParserError
  halt 400, json(error: "INVALID_JSON")
end

def verify_paypal_webhook_signature!(rack_request, raw_body, webhook_event)
  webhook_id = ENV.fetch("PAYPAL_WEBHOOK_ID")

  verification_payload = {
    auth_algo: rack_request.env["HTTP_PAYPAL_AUTH_ALGO"],
    cert_url: rack_request.env["HTTP_PAYPAL_CERT_URL"],
    transmission_id: rack_request.env["HTTP_PAYPAL_TRANSMISSION_ID"],
    transmission_sig: rack_request.env["HTTP_PAYPAL_TRANSMISSION_SIG"],
    transmission_time: rack_request.env["HTTP_PAYPAL_TRANSMISSION_TIME"],
    webhook_id: webhook_id,
    webhook_event: webhook_event
  }

  conn = Faraday.new(url: paypal_api_base) do |f|
    f.request :json
    f.adapter Faraday.default_adapter
  end

  response = conn.post("/v1/notifications/verify-webhook-signature") do |req|
    req.headers["Authorization"] = "Bearer #{paypal_access_token}"
    req.headers["Content-Type"] = "application/json"
    req.body = verification_payload
  end

  return false unless response.success?

  result = JSON.parse(response.body)
  result["verification_status"] == "SUCCESS"
rescue StandardError => e
  logger.error ["webhook_verify", e.message].join(" ")
  false
end

def paypal_api_base
  ENV.fetch("PAYPAL_ENVIRONMENT", "sandbox").downcase == "production" \
    ? "https://api-m.paypal.com" \
    : "https://api-m.sandbox.paypal.com"
end

def paypal_access_token
  PaypalOAuth.access_token
end

def handle_capture_completed(resource)
  # Idempotent upsert by capture id
end

def handle_capture_denied(resource)
  # Update order state
end

def handle_order_approved(resource)
  # Optional: reconcile with checkout session
end
```

**Header access in Rack:** names are uppercased with `HTTP_` prefix and hyphens become underscores.

---

## Raw body requirement

Signature verification needs the **exact** raw POST body. In Sinatra, read `request.body.read` **once** before other middleware consumes it. In Rails, use **`request.raw_post`** or middleware that preserves raw body.

---

## Rails — `create` action

```ruby
class Paypal::WebhooksController < ApplicationController
  skip_forgery_protection # only if appropriate; prefer secret URL + verification

  def create
    raw = request.raw_post
    event = JSON.parse(raw)
    unless Paypal::WebhookVerifier.verify!(request.headers, raw, event)
      head :unauthorized and return
    end

    Paypal::WebhookProcessorJob.perform_later(event)
    head :ok
  end
end
```

Prefer **async** processing so you respond quickly with **200**.

---

## Best practices

- Return **200** after you accept the message; use a job queue for heavy work.
- **Dedupe** by `event.id` (or transmission id) to avoid double processing.
- Use separate sandbox vs production **webhook IDs** and URLs.

## Common issues

| Issue | Fix |
|-------|-----|
| Verification always fails | Wrong `webhook_id`; body altered; body read twice |
| Wrong dashboard URL | Must match public HTTPS route exactly |
