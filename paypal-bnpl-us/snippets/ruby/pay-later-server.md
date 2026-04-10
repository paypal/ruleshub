# Pay Later Server-Side (Ruby/Sinatra) — US

Server-side order creation and capture for Pay Later. No special order payload is needed.

Source: https://docs.paypal.ai/reference/api/rest/orders/create-order

## Sinatra Implementation

```ruby
require "sinatra"
require "net/http"
require "json"
require "base64"
require "securerandom"

PAYPAL_CLIENT_ID = ENV.fetch("PAYPAL_CLIENT_ID")
PAYPAL_CLIENT_SECRET = ENV.fetch("PAYPAL_CLIENT_SECRET")
PAYPAL_BASE_URL = ENV.fetch("PAYPAL_BASE_URL", "https://api-m.sandbox.paypal.com")

def get_access_token
  uri = URI("#{PAYPAL_BASE_URL}/v1/oauth2/token")
  http = Net::HTTP.new(uri.host, uri.port)
  http.use_ssl = true

  request = Net::HTTP::Post.new(uri)
  request["Authorization"] = "Basic " + Base64.strict_encode64("#{PAYPAL_CLIENT_ID}:#{PAYPAL_CLIENT_SECRET}")
  request["Content-Type"] = "application/x-www-form-urlencoded"
  request.body = "grant_type=client_credentials"

  response = http.request(request)
  JSON.parse(response.body)["access_token"]
end

post "/paypal-api/checkout/orders/create" do
  content_type :json

  begin
    data = JSON.parse(request.body.read)
    access_token = get_access_token

    order_payload = {
      intent: "CAPTURE",
      purchase_units: [{
        amount: {
          currency_code: data.fetch("currency_code", "USD"),
          value: format("%.2f", data["amount"].to_f)
        }
      }]
    }

    uri = URI("#{PAYPAL_BASE_URL}/v2/checkout/orders")
    http = Net::HTTP.new(uri.host, uri.port)
    http.use_ssl = true

    req = Net::HTTP::Post.new(uri)
    req["Content-Type"] = "application/json"
    req["Authorization"] = "Bearer #{access_token}"
    req["PayPal-Request-Id"] = SecureRandom.uuid
    req.body = order_payload.to_json

    response = http.request(req)
    status response.code.to_i
    response.body

  rescue => e
    status 500
    { error: "ORDER_CREATION_FAILED" }.to_json
  end
end

post "/paypal-api/checkout/orders/:order_id/capture" do
  content_type :json

  begin
    access_token = get_access_token

    uri = URI("#{PAYPAL_BASE_URL}/v2/checkout/orders/#{params[:order_id]}/capture")
    http = Net::HTTP.new(uri.host, uri.port)
    http.use_ssl = true

    req = Net::HTTP::Post.new(uri)
    req["Content-Type"] = "application/json"
    req["Authorization"] = "Bearer #{access_token}"
    req["PayPal-Request-Id"] = SecureRandom.uuid

    response = http.request(req)
    status response.code.to_i
    response.body

  rescue => e
    status 500
    { error: "CAPTURE_FAILED" }.to_json
  end
end
```

## Key Points

- No special API fields for Pay Later — standard `POST /v2/checkout/orders` works
- Use `intent: CAPTURE` for Pay Later transactions
- Store credentials in environment variables, never hardcoded
- US Pay in 4: $30–$1,500; Pay Monthly: $49–$10,000
