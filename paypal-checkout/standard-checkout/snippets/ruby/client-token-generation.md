# Client Token Generation — Ruby (JS SDK v6)

For **JavaScript SDK v6**, the browser needs a **browser-safe client token** from your server. Never expose `PAYPAL_CLIENT_SECRET` in frontend code.

## OAuth endpoint

**POST** `{PAYPAL_API_BASE}/v1/oauth2/token`

- **Sandbox**: `https://api-m.sandbox.paypal.com`
- **Production**: `https://api-m.paypal.com`

**Body** (form URL-encoded):

```
grant_type=client_credentials&response_type=client_token&intent=sdk_init
```

**Authorization**: `Basic` + Base64(`client_id:client_secret`).

## Route

**GET** `/paypal-api/auth/browser-safe-client-token`  
Returns JSON the client can pass to `createInstance` (use `accessToken` or `client_token` consistently with `sdk-initialization.md`).

---

## Sinatra — Faraday + in-memory cache

```ruby
# frozen_string_literal: true

require "sinatra"
require "sinatra/json"
require "base64"
require "json"
require "faraday"

class PaypalOAuthError < StandardError
  attr_reader :status, :paypal_debug_id, :response_body

  def initialize(status:, paypal_debug_id:, body:)
    @status = status
    @paypal_debug_id = paypal_debug_id
    @response_body = body
    super("PayPal OAuth failed: HTTP #{status}")
  end
end

configure do
  set :paypal_token_cache, { token: nil, expires_at: nil }
end

def paypal_api_base
  ENV.fetch("PAYPAL_ENVIRONMENT", "sandbox").downcase == "production" \
    ? "https://api-m.paypal.com" \
    : "https://api-m.sandbox.paypal.com"
end

def paypal_basic_auth_header
  raw = "#{ENV.fetch('PAYPAL_CLIENT_ID')}:#{ENV.fetch('PAYPAL_CLIENT_SECRET')}"
  "Basic #{Base64.strict_encode64(raw)}"
end

def fetch_browser_safe_client_token_from_paypal
  conn = Faraday.new(url: paypal_api_base) do |f|
    f.request :url_encoded
    f.adapter Faraday.default_adapter
  end

  response = conn.post("/v1/oauth2/token") do |req|
    req.headers["Authorization"] = paypal_basic_auth_header
    req.headers["Content-Type"] = "application/x-www-form-urlencoded"
    req.body = {
      grant_type: "client_credentials",
      response_type: "client_token",
      intent: "sdk_init"
    }
  end

  unless response.success?
    raise PaypalOAuthError.new(
      status: response.status,
      paypal_debug_id: response.headers["paypal-debug-id"],
      body: response.body
    )
  end

  JSON.parse(response.body)
end

get "/paypal-api/auth/browser-safe-client-token" do
  cache = settings.paypal_token_cache
  buffer_sec = 120
  now = Time.now.to_f

  if cache[:token] && cache[:expires_at] && now < cache[:expires_at]
    expires_in = [(cache[:expires_at] - now).to_i, 0].max
    return json(accessToken: cache[:token], expiresIn: expires_in)
  end

  body = fetch_browser_safe_client_token_from_paypal
  token = body["access_token"] || body["client_token"]
  expires_in = body["expires_in"].to_i
  cache[:token] = token
  cache[:expires_at] = now + [expires_in - buffer_sec, 60].max

  json accessToken: token, expiresIn: expires_in
rescue PaypalOAuthError => e
  status [e.status, 502].min
  json(
    error: "TOKEN_GENERATION_FAILED",
    message: "PayPal OAuth failed",
    paypal_debug_id: e.paypal_debug_id
  )
rescue StandardError => e
  logger.error ["client_token", e.class, e.message].join(" ")
  status 500
  json error: "TOKEN_GENERATION_FAILED", message: e.message
end
```

---

## Sinatra — Net::HTTP (no Faraday)

```ruby
# frozen_string_literal: true

require "net/http"
require "uri"
require "base64"
require "json"

def post_oauth_client_token
  uri = URI.join(paypal_api_base + "/", "v1/oauth2/token")
  http = Net::HTTP.new(uri.host, uri.port)
  http.use_ssl = true
  http.open_timeout = 10
  http.read_timeout = 30

  req = Net::HTTP::Post.new(uri)
  req["Authorization"] = paypal_basic_auth_header
  req["Content-Type"] = "application/x-www-form-urlencoded"
  req.body = URI.encode_www_form(
    grant_type: "client_credentials",
    response_type: "client_token",
    intent: "sdk_init"
  )

  http.request(req)
end
```

On success, parse `JSON.parse(res.body)`; on failure, log `res["paypal-debug-id"]`.

---

## Token caching

- Cache in memory until shortly before `expires_in` (e.g. 60–120 second buffer).
- For multiple app instances, use **Redis** so all processes share one token.

---

## Rails controller sketch

```ruby
# app/controllers/paypal/auth_controller.rb
class Paypal::AuthController < ApplicationController
  def browser_safe_client_token
    token, expires_in = Paypal::ClientToken.fetch_cached
    render json: { accessToken: token, expiresIn: expires_in }
  end
end
```

---

## Best practices

- Rate-limit the token endpoint if it is public.
- Log `PayPal-Debug-Id` on failures, not the token or secret.
- Use HTTPS end-to-end in production.

## Common issues

| Issue | Fix |
|-------|-----|
| `invalid_client` | Verify sandbox vs live credentials and `api-m` base URL |
| Missing token in JSON | Ensure `response_type=client_token` and `intent=sdk_init` |
