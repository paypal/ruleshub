# Use Saved Payment (Server-Side)

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

get '/paypal-api/customer/payment-methods' do
  content_type :json
  
  begin
    customer_id = params[:customer_id]
    
    if customer_id.nil? || customer_id.empty?
      status 400
      return {
        error: 'MISSING_CUSTOMER_ID',
        message: 'customer_id is required'
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

post '/paypal-api/checkout/orders/create-with-saved-card' do
  content_type :json
  
  begin
    request_body = JSON.parse(request.body.read)
    vault_id = request_body['vaultId']
    
    if vault_id.nil? || vault_id.empty?
      status 400
      return {
        error: 'MISSING_VAULT_ID',
        message: 'vaultId is required'
      }.to_json
    end
    
    access_token = get_access_token
    amount = request_body['amount']
    currency = request_body['currency'] || 'USD'
    
    order_payload = {
      intent: 'CAPTURE',
      purchase_units: [{
        amount: {
          currency_code: currency,
          value: '%.2f' % amount.to_f
        }
      }],
      payment_source: {
        card: {
          vault_id: vault_id
        }
      }
    }
    
    uri = URI.parse("#{PAYPAL_BASE_URL}/v2/checkout/orders")
    http = Net::HTTP.new(uri.host, uri.port)
    http.use_ssl = true
    
    req = Net::HTTP::Post.new(uri.path)
    req['Content-Type'] = 'application/json'
    req['Authorization'] = "Bearer #{access_token}"
    req['PayPal-Request-Id'] = SecureRandom.uuid
    req.body = order_payload.to_json
    
    response = http.request(req)
    order_data = JSON.parse(response.body)
    
    if order_data['status'] == 'CREATED'
      order_id = order_data['id']
      
      capture_uri = URI.parse("#{PAYPAL_BASE_URL}/v2/checkout/orders/#{order_id}/capture")
      capture_http = Net::HTTP.new(capture_uri.host, capture_uri.port)
      capture_http.use_ssl = true
      
      capture_req = Net::HTTP::Post.new(capture_uri.path)
      capture_req['Content-Type'] = 'application/json'
      capture_req['Authorization'] = "Bearer #{access_token}"
      capture_req['PayPal-Request-Id'] = SecureRandom.uuid
      capture_req.body = {}.to_json
      
      capture_response = capture_http.request(capture_req)
      return capture_response.body
    end
    
    response.body
    
  rescue => e
    status 500
    { error: 'PAYMENT_FAILED' }.to_json
  end
end

post '/paypal-api/checkout/orders/create-with-saved-paypal' do
  content_type :json
  
  begin
    request_body = JSON.parse(request.body.read)
    payment_token_id = request_body['paymentTokenId']
    
    if payment_token_id.nil? || payment_token_id.empty?
      status 400
      return {
        error: 'MISSING_PAYMENT_TOKEN',
        message: 'paymentTokenId is required'
      }.to_json
    end
    
    access_token = get_access_token
    amount = request_body['amount']
    currency = request_body['currency'] || 'USD'
    
    order_payload = {
      intent: 'CAPTURE',
      purchase_units: [{
        amount: {
          currency_code: currency,
          value: '%.2f' % amount.to_f
        }
      }],
      payment_source: {
        paypal: {
          vault_id: payment_token_id
        }
      }
    }
    
    uri = URI.parse("#{PAYPAL_BASE_URL}/v2/checkout/orders")
    http = Net::HTTP.new(uri.host, uri.port)
    http.use_ssl = true
    
    req = Net::HTTP::Post.new(uri.path)
    req['Content-Type'] = 'application/json'
    req['Authorization'] = "Bearer #{access_token}"
    req['PayPal-Request-Id'] = SecureRandom.uuid
    req.body = order_payload.to_json
    
    response = http.request(req)
    order_data = JSON.parse(response.body)
    
    if order_data['status'] == 'CREATED'
      order_id = order_data['id']
      
      capture_uri = URI.parse("#{PAYPAL_BASE_URL}/v2/checkout/orders/#{order_id}/capture")
      capture_http = Net::HTTP.new(capture_uri.host, capture_uri.port)
      capture_http.use_ssl = true
      
      capture_req = Net::HTTP::Post.new(capture_uri.path)
      capture_req['Content-Type'] = 'application/json'
      capture_req['Authorization'] = "Bearer #{access_token}"
      capture_req['PayPal-Request-Id'] = SecureRandom.uuid
      capture_req.body = {}.to_json
      
      capture_response = capture_http.request(capture_req)
      return capture_response.body
    end
    
    response.body
    
  rescue => e
    status 500
    { error: 'PAYMENT_FAILED' }.to_json
  end
end
```

