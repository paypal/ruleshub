#### Create Order with 3D Secure (Always)

```ruby
require 'sinatra'
require 'net/http'
require 'uri'
require 'json'
require 'securerandom'

post '/paypal-api/checkout/orders/create-3ds' do
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
          attributes: {
            verification: {
              method: 'SCA_ALWAYS'
            }
          },
          experience_context: {
            return_url: 'https://example.com/returnUrl',
            cancel_url: 'https://example.com/cancelUrl'
          }
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
    
    status response.code.to_i
    response.body
  rescue => e
    status 500
    { error: 'ORDER_CREATION_FAILED' }.to_json
  end
end
```

#### Create Order with SCA When Required

```ruby
post '/paypal-api/checkout/orders/create-sca' do
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
          attributes: {
            verification: {
              method: 'SCA_WHEN_REQUIRED'
            }
          },
          experience_context: {
            return_url: 'https://example.com/returnUrl',
            cancel_url: 'https://example.com/cancelUrl'
          }
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
    
    status response.code.to_i
    response.body
  rescue => e
    status 500
    { error: 'ORDER_CREATION_FAILED' }.to_json
  end
end
```

#### Vault Setup Token with 3DS

```ruby
post '/paypal-api/vault/setup-token-3ds' do
  content_type :json
  
  begin
    request_body = JSON.parse(request.body.read)
    access_token = get_access_token
    
    setup_token_payload = {
      payment_source: {
        card: {
          experience_context: {
            return_url: 'https://example.com/returnUrl',
            cancel_url: 'https://example.com/cancelUrl'
          },
          verification_method: request_body['scaMethod'] || 'SCA_WHEN_REQUIRED'
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
    response.body
  rescue => e
    status 500
    { error: 'SETUP_TOKEN_FAILED' }.to_json
  end
end
```

#### Capture with 3DS Logging

```ruby
post '/paypal-api/checkout/orders/:order_id/capture-3ds' do
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
    capture_data = JSON.parse(response.body)
    
    auth_result = capture_data.dig('payment_source', 'card', 'authentication_result')
    if auth_result
      three_ds = auth_result['three_d_secure']
      puts "3DS Authentication Result:"
      puts "  Order ID: #{capture_data['id']}"
      puts "  Liability Shift: #{auth_result['liability_shift']}"
      puts "  Auth Status: #{three_ds&.dig('authentication_status')}"
      puts "  Enrollment Status: #{three_ds&.dig('enrollment_status')}"
    end
    
    response.body
  rescue => e
    status 500
    { error: 'CAPTURE_FAILED' }.to_json
  end
end
```

