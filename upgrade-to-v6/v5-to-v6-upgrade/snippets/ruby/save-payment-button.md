# Save Payment Button (Server-Side)

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

post '/paypal-api/vault/setup-tokens/create' do
  content_type :json
  
  begin
    request_body = JSON.parse(request.body.read)
    access_token = get_access_token
    
    payment_method = request_body['payment_method'] || 'paypal'
    
    if payment_method == 'paypal'
      payload = {
        payment_source: {
          paypal: {
            usage_type: 'MERCHANT',
            customer_type: 'CONSUMER',
            permit_multiple_payment_tokens: true
          }
        }
      }
    elsif payment_method == 'card'
      payload = {
        payment_source: {
          card: {
            experience_context: {
              return_url: request_body['return_url'] || 'https://example.com/returnUrl',
              cancel_url: request_body['cancel_url'] || 'https://example.com/cancelUrl'
            },
            verification_method: 'SCA_WHEN_REQUIRED'
          }
        }
      }
    else
      status 400
      return {
        error: 'INVALID_PAYMENT_METHOD',
        message: 'Payment method must be paypal or card'
      }.to_json
    end
    
    uri = URI.parse("#{PAYPAL_BASE_URL}/v3/vault/setup-tokens")
    http = Net::HTTP.new(uri.host, uri.port)
    http.use_ssl = true
    
    req = Net::HTTP::Post.new(uri.path)
    req['Content-Type'] = 'application/json'
    req['Authorization'] = "Bearer #{access_token}"
    req['PayPal-Request-Id'] = SecureRandom.uuid
    req.body = payload.to_json
    
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
    { error: 'SETUP_TOKEN_FAILED' }.to_json
  end
end

post '/paypal-api/vault/payment-tokens/create' do
  content_type :json
  
  begin
    request_body = JSON.parse(request.body.read)
    setup_token = request_body['vaultSetupToken']
    
    if setup_token.nil? || setup_token.empty?
      status 400
      return {
        error: 'MISSING_SETUP_TOKEN',
        message: 'vaultSetupToken is required'
      }.to_json
    end
    
    access_token = get_access_token
    
    payload = {
      payment_source: {
        token: {
          id: setup_token,
          type: 'SETUP_TOKEN'
        }
      }
    }
    
    uri = URI.parse("#{PAYPAL_BASE_URL}/v3/vault/payment-tokens")
    http = Net::HTTP.new(uri.host, uri.port)
    http.use_ssl = true
    
    req = Net::HTTP::Post.new(uri.path)
    req['Content-Type'] = 'application/json'
    req['Authorization'] = "Bearer #{access_token}"
    req['PayPal-Request-Id'] = SecureRandom.uuid
    req.body = payload.to_json
    
    response = http.request(req)
    token_data = JSON.parse(response.body)
    
    if response.code.to_i != 200 && response.code.to_i != 201
      status response.code.to_i
      return token_data.to_json
    end
    
    {
      id: token_data['id'],
      customerId: token_data.dig('customer', 'id'),
      status: 'saved'
    }.to_json
    
  rescue => e
    status 500
    { error: 'PAYMENT_TOKEN_FAILED' }.to_json
  end
end
```

