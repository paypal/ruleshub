#### Complete Sinatra Server for v6 SDK

```ruby
require 'sinatra'
require 'net/http'
require 'uri'
require 'json'
require 'base64'
require 'securerandom'

set :port, 3000
set :bind, '0.0.0.0'

PAYPAL_BASE = ENV['PAYPAL_BASE'] || 'https://api-m.sandbox.paypal.com'
CLIENT_ID = ENV['PAYPAL_CLIENT_ID']
CLIENT_SECRET = ENV['PAYPAL_CLIENT_SECRET']

before do
  headers['Access-Control-Allow-Origin'] = '*'
  headers['Access-Control-Allow-Methods'] = 'GET, POST, PUT, DELETE, OPTIONS'
  headers['Access-Control-Allow-Headers'] = 'Content-Type, Authorization, PayPal-Request-Id'
end

options '*' do
  200
end

def get_access_token
  auth = Base64.strict_encode64("#{CLIENT_ID}:#{CLIENT_SECRET}")
  
  uri = URI.parse("#{PAYPAL_BASE}/v1/oauth2/token")
  http = Net::HTTP.new(uri.host, uri.port)
  http.use_ssl = true
  
  request = Net::HTTP::Post.new(uri.path)
  request['Authorization'] = "Basic #{auth}"
  request['Content-Type'] = 'application/x-www-form-urlencoded'
  request.body = 'grant_type=client_credentials'
  
  response = http.request(request)
  data = JSON.parse(response.body)
  data['access_token']
end

get '/paypal-api/auth/browser-safe-client-token' do
  content_type :json
  
  begin
    auth = Base64.strict_encode64("#{CLIENT_ID}:#{CLIENT_SECRET}")
    
    uri = URI.parse("#{PAYPAL_BASE}/v1/oauth2/token")
    http = Net::HTTP.new(uri.host, uri.port)
    http.use_ssl = true
    
    request = Net::HTTP::Post.new(uri.path)
    request['Authorization'] = "Basic #{auth}"
    request['Content-Type'] = 'application/x-www-form-urlencoded'
    request.body = 'grant_type=client_credentials&response_type=client_token&intent=sdk_init'
    
    response = http.request(request)
    token_data = JSON.parse(response.body)
    
    { accessToken: token_data['access_token'] }.to_json
  rescue => e
    status 500
    { error: 'TOKEN_GENERATION_FAILED' }.to_json
  end
end

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

post '/paypal-api/checkout/orders/:order_id/capture' do
  content_type :json
  
  begin
    order_id = params[:order_id]
    access_token = get_access_token
    
    uri = URI.parse("#{PAYPAL_BASE}/v2/checkout/orders/#{order_id}/capture")
    http = Net::HTTP.new(uri.host, uri.port)
    http.use_ssl = true
    
    request = Net::HTTP::Post.new(uri.path)
    request['Content-Type'] = 'application/json'
    request['Authorization'] = "Bearer #{access_token}"
    request['PayPal-Request-Id'] = SecureRandom.uuid
    request.body = {}.to_json
    
    response = http.request(request)
    response.body
  rescue => e
    status 500
    { error: 'CAPTURE_FAILED' }.to_json
  end
end
```

#### Environment Variables (.env)

```bash
export PAYPAL_CLIENT_ID=your_client_id_here
export PAYPAL_CLIENT_SECRET=your_client_secret_here
export PAYPAL_BASE=https://api-m.sandbox.paypal.com
```

#### Gemfile

```ruby
source 'https://rubygems.org'

gem 'sinatra', '~> 3.0'
gem 'puma', '~> 6.0'
gem 'dotenv', '~> 2.8'
```

#### Run Server

```bash
bundle install
ruby server.rb
```

