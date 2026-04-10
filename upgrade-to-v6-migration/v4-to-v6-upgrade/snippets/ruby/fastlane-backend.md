#### Fastlane - Create Order with Single-Use Token

```ruby
require 'sinatra'
require 'net/http'
require 'uri'
require 'json'
require 'securerandom'

post '/paypal-api/checkout/orders/create' do
  content_type :json
  
  begin
    request_body = JSON.parse(request.body.read)
    access_token = get_access_token
    
    paypal_request_id = request.env['HTTP_PAYPAL_REQUEST_ID'] || SecureRandom.uuid
    
    uri = URI.parse("#{PAYPAL_BASE}/v2/checkout/orders")
    http = Net::HTTP.new(uri.host, uri.port)
    http.use_ssl = true
    
    req = Net::HTTP::Post.new(uri.path)
    req['Content-Type'] = 'application/json'
    req['Authorization'] = "Bearer #{access_token}"
    req['PayPal-Request-Id'] = paypal_request_id
    req.body = request_body.to_json
    
    response = http.request(req)
    
    status response.code.to_i
    response.body
  rescue => e
    status 500
    { error: 'ORDER_CREATION_FAILED' }.to_json
  end
end
```

#### CORS Configuration

```ruby
require 'sinatra'

before do
  headers['Access-Control-Allow-Origin'] = '*'
  headers['Access-Control-Allow-Methods'] = 'GET, POST, PUT, DELETE, OPTIONS'
  headers['Access-Control-Allow-Headers'] = 'Content-Type, Authorization, PayPal-Request-Id'
end

options '*' do
  200
end
```

