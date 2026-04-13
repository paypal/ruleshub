#### Create Order with Vault Directive

```ruby
require 'sinatra'
require 'net/http'
require 'uri'
require 'json'
require 'securerandom'

post '/paypal-api/checkout/orders/create-with-vault' do
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
      }]
    }
    
    if request_body['saveCard']
      order_payload[:payment_source] = {
        card: {
          attributes: {
            verification: {
              method: 'SCA_WHEN_REQUIRED'
            },
            vault: {
              store_in_vault: 'ON_SUCCESS',
              usage_type: 'MERCHANT',
              customer_type: 'CONSUMER',
              permit_multiple_payment_tokens: true
            }
          }
        }
      }
    end
    
    uri = URI.parse("#{PAYPAL_BASE}/v2/checkout/orders")
    http = Net::HTTP.new(uri.host, uri.port)
    http.use_ssl = true
    
    request = Net::HTTP::Post.new(uri.path)
    request['Content-Type'] = 'application/json'
    request['Authorization'] = "Bearer #{access_token}"
    request['PayPal-Request-Id'] = SecureRandom.uuid
    request.body = order_payload.to_json
    
    response = http.request(request)
    
    status response.code.to_i
    response.body
  rescue => e
    status 500
    { error: 'ORDER_CREATION_FAILED' }.to_json
  end
end
```

#### Create Order with Vault ID

```ruby
post '/paypal-api/checkout/orders/create-with-vault-id' do
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
        card: {
          vault_id: request_body['vaultId']
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
    
    capture_uri = URI.parse("#{PAYPAL_BASE}/v2/checkout/orders/#{order_data['id']}/capture")
    capture_http = Net::HTTP.new(capture_uri.host, capture_uri.port)
    capture_http.use_ssl = true
    
    capture_request = Net::HTTP::Post.new(capture_uri.path)
    capture_request['Content-Type'] = 'application/json'
    capture_request['Authorization'] = "Bearer #{access_token}"
    capture_request['PayPal-Request-Id'] = SecureRandom.uuid
    capture_request.body = {}.to_json
    
    capture_response = capture_http.request(capture_request)
    capture_response.body
  rescue => e
    status 500
    { error: 'PAYMENT_FAILED' }.to_json
  end
end
```

#### List Payment Tokens

```ruby
get '/paypal-api/vault/payment-tokens' do
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
    response.body
  rescue => e
    status 500
    { error: 'FETCH_FAILED' }.to_json
  end
end
```

#### Delete Payment Token

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
      { success: true, message: 'Card deleted successfully' }.to_json
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

