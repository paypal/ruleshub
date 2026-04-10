#### Generate Client Token for v6 SDK

```ruby
require 'sinatra'
require 'net/http'
require 'uri'
require 'json'
require 'base64'

PAYPAL_BASE = ENV['PAYPAL_BASE'] || 'https://api-m.sandbox.paypal.com'
CLIENT_ID = ENV['PAYPAL_CLIENT_ID']
CLIENT_SECRET = ENV['PAYPAL_CLIENT_SECRET']

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
    
    {
      accessToken: token_data['access_token'],
      expiresIn: token_data['expires_in']
    }.to_json
  rescue => e
    status 500
    { error: 'TOKEN_GENERATION_FAILED' }.to_json
  end
end
```

