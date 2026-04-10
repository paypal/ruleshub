# Error Handling — Ruby + PayPal REST

Production integrations should **rescue** errors, **log PayPal Debug IDs**, and **retry** only when safe (network timeouts, idempotent operations with request IDs).

---

## Sinatra — rescue and JSON error body

```ruby
# frozen_string_literal: true

require "sinatra"
require "sinatra/json"
require "json"

error JSON::ParserError do
  status 400
  json error: "INVALID_JSON"
end

error do
  e = env["sinatra.error"]
  logger.error [e.class, e.message, e.backtrace&.first].join(" | ")
  status 500
  json error: "INTERNAL_ERROR", message: "An unexpected error occurred"
end
```

---

## Faraday — raise errors and parse body

```ruby
require "faraday"
require "json"

def paypal_post(path, body)
  conn = Faraday.new(url: paypal_api_base) do |f|
    f.request :json
    f.response :raise_error # optional: raises Faraday::Error on 4xx/5xx
    f.adapter Faraday.default_adapter
  end

  conn.post(path) do |req|
    req.headers["Authorization"] = "Bearer #{PaypalOAuth.access_token}"
    req.headers["Content-Type"] = "application/json"
    req.body = body
  end
rescue Faraday::ClientError, Faraday::ServerError => e
  debug_id = e.response&.headers&.dig("paypal-debug-id")
  log_paypal_failure("POST #{path}", e.response&.status, debug_id, e.response&.body)
  raise
end

def log_paypal_failure(action, status, paypal_debug_id, body)
  warn({
    action: action,
    http_status: status,
    paypal_debug_id: paypal_debug_id,
    body_preview: body&.slice(0, 500)
  }.to_json)
end
```

Without `raise_error`, check `response.success?` explicitly.

---

## Extracting PayPal Debug ID

PayPal returns `PayPal-Debug-Id` (case varies) on error responses:

```ruby
def extract_paypal_debug_id(response)
  return unless response

  h = response.headers
  h["paypal-debug-id"] || h["PayPal-Debug-Id"] ||
    h.find { |k, _| k.to_s.downcase.tr("_", "-") == "paypal-debug-id" }&.last
end
```

---

## Net::HTTP

```ruby
unless res.is_a?(Net::HTTPSuccess)
  debug_id = res["paypal-debug-id"] || res["PayPal-Debug-Id"]
  logger.error({ status: res.code, paypal_debug_id: debug_id, body: res.body }.to_s)
end
```

---

## Retry logic (safe cases)

Use **retries** for:

- Transient network errors (`Errno::ETIMEDOUT`, `OpenSSL::SSL::SSLError`, Faraday timeout errors)
- HTTP **429** with backoff (respect `Retry-After` if present)

Use **idempotency** for:

- Creates and captures where PayPal supports `PayPal-Request-Id` header

```ruby
require "securerandom"

def with_retries(max: 3)
  attempts = 0
  begin
    attempts += 1
    yield
  rescue Faraday::TimeoutError, Errno::ETIMEDOUT => e
    raise if attempts >= max

    sleep(2**attempts * 0.1)
    retry
  end
end
```

Do **not** blindly retry non-idempotent calls without `PayPal-Request-Id` or a deduplication strategy.

---

## Map PayPal error JSON

PayPal often returns:

```json
{
  "name": "UNPROCESSABLE_ENTITY",
  "details": [{ "field": "...", "issue": "..." }]
}
```

```ruby
def parse_paypal_error_body(body)
  JSON.parse(body)
rescue JSON::ParserError
  { "raw" => body }
end
```

---

## Rails

- Use `rescue_from` in `ApplicationController` for API controllers.
- Report to your APM with `paypal_debug_id` as a tag.

---

## Best practices

- Never log **access tokens**, **client secrets**, or full PAN data.
- Always include **debug ID** when opening PayPal support tickets.
