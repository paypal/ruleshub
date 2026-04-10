# Webhooks — Ruby (Sinatra)

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
  else
    # acknowledge but ignore or log
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
    req.headers["Authorization"] = "Bearer #{PaypalOAuth.access_token}"
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

def handle_capture_completed(resource)
  # Idempotent: upsert by capture id
  # capture_id = resource.dig("id") or resource["id"]
end

def handle_capture_denied(resource)
  # Update order state
end
```

**Note**: Header names in Rack are often uppercased with `HTTP_` prefix and hyphens become underscores. If your server passes headers differently, read from `request.env` accordingly:

```ruby
{
  auth_algo: request.env["HTTP_PAYPAL_AUTH_ALGO"],
  cert_url: request.env["HTTP_PAYPAL_CERT_URL"],
  transmission_id: request.env["HTTP_PAYPAL_TRANSMISSION_ID"],
  transmission_sig: request.env["HTTP_PAYPAL_TRANSMISSION_SIG"],
  transmission_time: request.env["HTTP_PAYPAL_TRANSMISSION_TIME"]
}
```

---

## Raw body requirement

Signature verification needs the **exact** raw POST body. In Sinatra, read `request.body.read` once before JSON parsing elsewhere. For Rails, use `request.raw_post` or middleware that preserves raw body.

---

## Net::HTTP verification (sketch)

```ruby
require "net/http"
require "uri"
require "json"

uri = URI("#{paypal_api_base}/v1/notifications/verify-webhook-signature")
http = Net::HTTP.new(uri.host, uri.port)
http.use_ssl = true

req = Net::HTTP::Post.new(uri)
req["Authorization"] = "Bearer #{PaypalOAuth.access_token}"
req["Content-Type"] = "application/json"
req.body = JSON.generate(verification_payload)

res = http.request(req)
```

---

## Rails — `create` action

```ruby
class Paypal::WebhooksController < ApplicationController
  skip_forgery_protection # only if CSRF does not apply to PayPal POST; prefer a dedicated route with secret path + IP allowlist

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

Prefer **async** processing (Sidekiq, Active Job) so you respond quickly with `200`.

---

## Best practices

- Return **200** only after you accept responsibility for the message; use a job queue for heavy work.
- **Dedupe** by `event.id` (or transmission id + payload hash) to avoid double processing.
- Re-register webhook URL when rotating domains; use separate sandbox vs production webhook IDs.

## Common issues

| Issue | Fix |
|-------|-----|
| Verification always fails | Wrong `webhook_id`; body altered by middleware; body read twice |
| Wrong URL in dashboard | Must match public HTTPS route exactly |
