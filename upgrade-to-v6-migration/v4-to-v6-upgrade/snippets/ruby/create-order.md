#### Create Order (Basic)

```ruby
require 'sinatra'
require 'net/http'
require 'uri'
require 'json'
require 'securerandom'

post '/paypal-api/checkout/orders/create' do
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

#### Create Order with Details

```ruby
post '/paypal-api/checkout/orders/create-with-details' do
  content_type :json
  
  begin
    request_body = JSON.parse(request.body.read)
    access_token = get_access_token
    
    items = (request_body['items'] || []).map do |item|
      {
        name: item['name'],
        quantity: item['quantity'].to_s,
        unit_amount: {
          currency_code: request_body['currency'] || 'USD',
          value: item['price']
        },
        sku: item['sku']
      }
    end
    
    details = request_body['details'] || {}
    currency = request_body['currency'] || 'USD'
    
    order_payload = {
      intent: 'CAPTURE',
      purchase_units: [{
        amount: {
          currency_code: currency,
          value: request_body['amount'],
          breakdown: {
            item_total: {
              currency_code: currency,
              value: details['subtotal'] || request_body['amount']
            },
            shipping: {
              currency_code: currency,
              value: details['shipping'] || '0.00'
            },
            tax_total: {
              currency_code: currency,
              value: details['tax'] || '0.00'
            }
          }
        },
        description: request_body['description'] || 'Purchase',
        items: items
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

