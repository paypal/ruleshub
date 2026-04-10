#### Create Order with AUTHORIZE Intent

```ruby
require 'sinatra'
require 'net/http'
require 'uri'
require 'json'
require 'securerandom'

post '/paypal-api/checkout/orders/create-authorize' do
  content_type :json
  
  begin
    request_body = JSON.parse(request.body.read)
    access_token = get_access_token
    
    order_payload = {
      intent: 'AUTHORIZE',
      purchase_units: [{
        amount: {
          currency_code: request_body['currency'] || 'USD',
          value: request_body['amount']
        }
      }]
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

#### Authorize Order

```ruby
post '/paypal-api/checkout/orders/:order_id/authorize' do
  content_type :json
  
  begin
    order_id = params[:order_id]
    access_token = get_access_token
    
    uri = URI.parse("#{PAYPAL_BASE}/v2/checkout/orders/#{order_id}/authorize")
    http = Net::HTTP.new(uri.host, uri.port)
    http.use_ssl = true
    
    request = Net::HTTP::Post.new(uri.path)
    request['Content-Type'] = 'application/json'
    request['Authorization'] = "Bearer #{access_token}"
    request['PayPal-Request-Id'] = SecureRandom.uuid
    request.body = {}.to_json
    
    response = http.request(request)
    auth_data = JSON.parse(response.body)
    
    authorization_id = auth_data['purchase_units'][0]['payments']['authorizations'][0]['id']
    
    {
      authorizationId: authorization_id,
      status: auth_data['status'],
      details: auth_data
    }.to_json
  rescue => e
    status 500
    { error: 'AUTHORIZATION_FAILED' }.to_json
  end
end
```

#### Capture Authorization

```ruby
post '/paypal-api/payments/authorizations/:authorization_id/capture' do
  content_type :json
  
  begin
    authorization_id = params[:authorization_id]
    request_body = JSON.parse(request.body.read)
    access_token = get_access_token
    
    capture_payload = {}
    
    if request_body['amount']
      capture_payload[:amount] = {
        value: request_body['amount'],
        currency_code: request_body['currency'] || 'USD'
      }
    end
    
    capture_payload[:final_capture] = request_body.fetch('finalCapture', true)
    
    capture_payload[:invoice_id] = request_body['invoiceId'] if request_body['invoiceId']
    capture_payload[:note_to_payer] = request_body['noteToPayer'] if request_body['noteToPayer']
    
    uri = URI.parse("#{PAYPAL_BASE}/v2/payments/authorizations/#{authorization_id}/capture")
    http = Net::HTTP.new(uri.host, uri.port)
    http.use_ssl = true
    
    request = Net::HTTP::Post.new(uri.path)
    request['Content-Type'] = 'application/json'
    request['Authorization'] = "Bearer #{access_token}"
    request['PayPal-Request-Id'] = SecureRandom.uuid
    request.body = capture_payload.to_json
    
    response = http.request(request)
    response.body
  rescue => e
    status 500
    { error: 'CAPTURE_FAILED' }.to_json
  end
end
```

#### Get Authorization Details

```ruby
get '/paypal-api/payments/authorizations/:authorization_id' do
  content_type :json
  
  begin
    authorization_id = params[:authorization_id]
    access_token = get_access_token
    
    uri = URI.parse("#{PAYPAL_BASE}/v2/payments/authorizations/#{authorization_id}")
    http = Net::HTTP.new(uri.host, uri.port)
    http.use_ssl = true
    
    request = Net::HTTP::Get.new(uri.path)
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

