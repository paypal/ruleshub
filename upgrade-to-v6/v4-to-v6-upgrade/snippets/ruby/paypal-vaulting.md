#### Create Setup Token (Save PayPal Without Purchase)

```ruby
require 'sinatra'
require 'net/http'
require 'uri'
require 'json'
require 'securerandom'

post '/paypal-api/vault/setup-token/create' do
  content_type :json
  
  begin
    access_token = get_access_token
    
    setup_token_payload = {
      payment_source: {
        paypal: {
          usage_type: 'MERCHANT',
          customer_type: 'CONSUMER',
          permit_multiple_payment_tokens: true
        }
      }
    }
    
    uri = URI.parse("#{PAYPAL_BASE}/v3/vault/setup-tokens")
    http = Net::HTTP.new(uri.host, uri.port)
    http.use_ssl = true
    
    request = Net::HTTP::Post.new(uri.path)
    request['Content-Type'] = 'application/json'
    request['Authorization'] = "Bearer #{access_token}"
    request['PayPal-Request-Id'] = SecureRandom.uuid
    request.body = setup_token_payload.to_json
    
    response = http.request(request)
    setup_data = JSON.parse(response.body)
    
    {
      id: setup_data['id'],
      status: setup_data['status']
    }.to_json
  rescue => e
    status 500
    { error: 'SETUP_TOKEN_FAILED' }.to_json
  end
end
```

#### Create Payment Token from Setup Token

```ruby
post '/paypal-api/vault/payment-token/create' do
  content_type :json
  
  begin
    request_body = JSON.parse(request.body.read)
    access_token = get_access_token
    
    payment_token_payload = {
      payment_source: {
        token: {
          id: request_body['vaultSetupToken'],
          type: 'SETUP_TOKEN'
        }
      }
    }
    
    uri = URI.parse("#{PAYPAL_BASE}/v3/vault/payment-tokens")
    http = Net::HTTP.new(uri.host, uri.port)
    http.use_ssl = true
    
    request = Net::HTTP::Post.new(uri.path)
    request['Content-Type'] = 'application/json'
    request['Authorization'] = "Bearer #{access_token}"
    request['PayPal-Request-Id'] = SecureRandom.uuid
    request.body = payment_token_payload.to_json
    
    response = http.request(request)
    token_data = JSON.parse(response.body)
    
    {
      id: token_data['id'],
      customerId: token_data['customer']['id'],
      status: 'saved'
    }.to_json
  rescue => e
    status 500
    { error: 'PAYMENT_TOKEN_FAILED' }.to_json
  end
end
```

#### Create Order with Saved PayPal

```ruby
post '/paypal-api/checkout/orders/create-with-payment-token' do
  content_type :json
  
  begin
    request_body = JSON.parse(request.body.read)
    access_token = get_access_token
    
    order_payload = {
      intent: 'CAPTURE',
      purchase_units: [{
        amount: {
          currency_code: request_body['currency'] || 'USD',
          value: request_body['amount']
        }
      }],
      payment_source: {
        paypal: {
          vault_id: request_body['paymentTokenId']
        }
      }
    }
    
    uri = URI.parse("#{PAYPAL_BASE}/v2/checkout/orders")
    http = Net::HTTP.new(uri.host, uri.port)
    http.use_ssl = true
    
    request = Net::HTTP::Post.new(uri.path)
    request['Content-Type'] = 'application/json'
    request['Authorization'] = "Bearer #{access_token}"
    request['PayPal-Request-Id'] = SecureRandom.uuid
    request.body = order_payload.to_json
    
    response = http.request(request)
    order_data = JSON.parse(response.body)
    
    if order_data['status'] == 'CREATED'
      capture_uri = URI.parse("#{PAYPAL_BASE}/v2/checkout/orders/#{order_data['id']}/capture")
      capture_http = Net::HTTP.new(capture_uri.host, capture_uri.port)
      capture_http.use_ssl = true
      
      capture_request = Net::HTTP::Post.new(capture_uri.path)
      capture_request['Content-Type'] = 'application/json'
      capture_request['Authorization'] = "Bearer #{access_token}"
      capture_request['PayPal-Request-Id'] = SecureRandom.uuid
      capture_request.body = {}.to_json
      
      capture_response = capture_http.request(capture_request)
      return capture_response.body
    end
    
    response.body
  rescue => e
    status 500
    { error: 'ORDER_FAILED' }.to_json
  end
end
```

#### List Saved Payment Methods

```ruby
get '/paypal-api/customer/payment-methods' do
  content_type :json
  
  begin
    customer_id = params[:customer_id]
    access_token = get_access_token
    
    uri = URI.parse("#{PAYPAL_BASE}/v3/vault/payment-tokens?customer_id=#{customer_id}")
    http = Net::HTTP.new(uri.host, uri.port)
    http.use_ssl = true
    
    request = Net::HTTP::Get.new(uri.request_uri)
    request['Content-Type'] = 'application/json'
    request['Authorization'] = "Bearer #{access_token}"
    
    response = http.request(request)
    tokens_data = JSON.parse(response.body)
    
    {
      payment_tokens: tokens_data['payment_tokens'] || [],
      total_items: (tokens_data['payment_tokens'] || []).length
    }.to_json
  rescue => e
    status 500
    { error: 'FETCH_FAILED' }.to_json
  end
end
```

#### Delete Saved Payment Method

```ruby
delete '/paypal-api/vault/payment-tokens/:token_id' do
  content_type :json
  
  begin
    token_id = params[:token_id]
    access_token = get_access_token
    
    uri = URI.parse("#{PAYPAL_BASE}/v3/vault/payment-tokens/#{token_id}")
    http = Net::HTTP.new(uri.host, uri.port)
    http.use_ssl = true
    
    request = Net::HTTP::Delete.new(uri.path)
    request['Content-Type'] = 'application/json'
    request['Authorization'] = "Bearer #{access_token}"
    
    response = http.request(request)
    
    if response.code.to_i == 204
      { success: true, message: 'Payment method deleted' }.to_json
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

