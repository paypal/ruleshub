# Create Payment Token (Server-Side)

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

post '/paypal-api/vault/payment-tokens' do
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
    { error: 'PAYMENT_TOKEN_FAILED', message: 'Failed to create payment token' }.to_json
  end
end

get '/paypal-api/vault/payment-tokens' do
  content_type :json
  
  begin
    customer_id = params[:customer_id]
    
    if customer_id.nil? || customer_id.empty?
      status 400
      return {
        error: 'MISSING_CUSTOMER_ID',
        message: 'customer_id query parameter is required'
      }.to_json
    end
    
    access_token = get_access_token
    
    uri = URI.parse("#{PAYPAL_BASE_URL}/v3/vault/payment-tokens?customer_id=#{customer_id}")
    http = Net::HTTP.new(uri.host, uri.port)
    http.use_ssl = true
    
    request = Net::HTTP::Get.new(uri.request_uri)
    request['Authorization'] = "Bearer #{access_token}"
    request['Content-Type'] = 'application/json'
    
    response = http.request(request)
    tokens_data = JSON.parse(response.body)
    payment_tokens = tokens_data['payment_tokens'] || []
    
    {
      payment_tokens: payment_tokens,
      total_items: payment_tokens.length
    }.to_json
    
  rescue => e
    status 500
    { error: 'FETCH_FAILED' }.to_json
  end
end

get '/paypal-api/vault/payment-tokens/:token_id' do
  content_type :json
  
  begin
    token_id = params[:token_id]
    access_token = get_access_token
    
    uri = URI.parse("#{PAYPAL_BASE_URL}/v3/vault/payment-tokens/#{token_id}")
    http = Net::HTTP.new(uri.host, uri.port)
    http.use_ssl = true
    
    request = Net::HTTP::Get.new(uri.path)
    request['Authorization'] = "Bearer #{access_token}"
    request['Content-Type'] = 'application/json'
    
    response = http.request(request)
    
    if response.code.to_i != 200
      status 404
      return { error: 'TOKEN_NOT_FOUND' }.to_json
    end
    
    response.body
    
  rescue => e
    status 500
    { error: 'FETCH_FAILED' }.to_json
  end
end

delete '/paypal-api/vault/payment-tokens/:token_id' do
  content_type :json
  
  begin
    token_id = params[:token_id]
    access_token = get_access_token
    
    uri = URI.parse("#{PAYPAL_BASE_URL}/v3/vault/payment-tokens/#{token_id}")
    http = Net::HTTP.new(uri.host, uri.port)
    http.use_ssl = true
    
    request = Net::HTTP::Delete.new(uri.path)
    request['Authorization'] = "Bearer #{access_token}"
    request['Content-Type'] = 'application/json'
    
    response = http.request(request)
    
    if response.code.to_i == 204
      { success: true, message: 'Payment token deleted successfully' }.to_json
    else
      status response.code.to_i
      { success: false }.to_json
    end
    
  rescue => e
    status 500
    { error: 'DELETE_FAILED' }.to_json
  end
end
```

