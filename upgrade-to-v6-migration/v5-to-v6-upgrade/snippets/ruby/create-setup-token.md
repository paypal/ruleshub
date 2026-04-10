# Create Setup Token (Server-Side)

## Sinatra Implementation

```ruby
PAYPAL_CLIENT_ID = ENV['PAYPAL_CLIENT_ID']
PAYPAL_CLIENT_SECRET = ENV['PAYPAL_CLIENT_SECRET']
PAYPAL_BASE_URL = ENV['PAYPAL_BASE_URL'] || 'https://api-m.sandbox.paypal.com'

def get_access_token
  auth = Base64.strict_encode64("#{PAYPAL_CLIENT_ID}:#{PAYPAL_CLIENT_SECRET}")
  
  uri = URI.parse("#{PAYPAL_BASE_URL}/v1/oauth2/token")
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

post '/paypal-api/vault/setup-tokens' do
  content_type :json
  
  begin
    request_body = JSON.parse(request.body.read)
    access_token = get_access_token
    
    payment_method = request_body['payment_method'] || 'paypal'
    setup_token_payload = {}
    
    if payment_method == 'paypal'
      setup_token_payload = {
        payment_source: {
          paypal: {
            usage_type: request_body['usage_type'] || 'MERCHANT',
            customer_type: request_body['customer_type'] || 'CONSUMER',
            permit_multiple_payment_tokens: request_body.fetch('permit_multiple_payment_tokens', true)
          }
        }
      }
    elsif payment_method == 'card'
      setup_token_payload = {
        payment_source: {
          card: {
            experience_context: {
              return_url: request_body['return_url'] || 'https://example.com/returnUrl',
              cancel_url: request_body['cancel_url'] || 'https://example.com/cancelUrl'
            },
            verification_method: request_body['verification_method'] || 'SCA_WHEN_REQUIRED'
          }
        }
      }
    end
    
    uri = URI.parse("#{PAYPAL_BASE_URL}/v3/vault/setup-tokens")
    http = Net::HTTP.new(uri.host, uri.port)
    http.use_ssl = true
    
    req = Net::HTTP::Post.new(uri.path)
    req['Content-Type'] = 'application/json'
    req['Authorization'] = "Bearer #{access_token}"
    req['PayPal-Request-Id'] = SecureRandom.uuid
    req.body = setup_token_payload.to_json
    
    response = http.request(req)
    setup_data = JSON.parse(response.body)
    
    if response.code.to_i != 200 && response.code.to_i != 201
      status response.code.to_i
      return setup_data.to_json
    end
    
    {
      id: setup_data['id'],
      status: setup_data['status']
    }.to_json
    
  rescue => e
    status 500
    { error: 'SETUP_TOKEN_FAILED', message: 'Failed to create setup token' }.to_json
  end
end

get '/paypal-api/vault/setup-tokens/:token_id' do
  content_type :json
  
  begin
    token_id = params[:token_id]
    access_token = get_access_token
    
    uri = URI.parse("#{PAYPAL_BASE_URL}/v3/vault/setup-tokens/#{token_id}")
    http = Net::HTTP.new(uri.host, uri.port)
    http.use_ssl = true
    
    request = Net::HTTP::Get.new(uri.path)
    request['Authorization'] = "Bearer #{access_token}"
    request['Content-Type'] = 'application/json'
    
    response = http.request(request)
    
    if response.code.to_i != 200
      status 404
      return { error: 'SETUP_TOKEN_NOT_FOUND' }.to_json
    end
    
    response.body
    
  rescue => e
    status 500
    { error: 'FETCH_FAILED' }.to_json
  end
end
```

