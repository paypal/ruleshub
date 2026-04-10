#### Full Refund

```ruby
require 'sinatra'
require 'net/http'
require 'uri'
require 'json'
require 'securerandom'

post '/paypal-api/payments/captures/:capture_id/refund' do
  content_type :json
  
  begin
    capture_id = params[:capture_id]
    access_token = get_access_token
    
    uri = URI.parse("#{PAYPAL_BASE}/v2/payments/captures/#{capture_id}/refund")
    http = Net::HTTP.new(uri.host, uri.port)
    http.use_ssl = true
    
    request = Net::HTTP::Post.new(uri.path)
    request['Content-Type'] = 'application/json'
    request['Authorization'] = "Bearer #{access_token}"
    request['PayPal-Request-Id'] = SecureRandom.uuid
    request.body = {}.to_json
    
    response = http.request(request)
    response.body
  rescue => e
    status 500
    { error: 'REFUND_FAILED' }.to_json
  end
end
```

#### Partial Refund

```ruby
post '/paypal-api/payments/captures/:capture_id/refund-partial' do
  content_type :json
  
  begin
    capture_id = params[:capture_id]
    request_body = JSON.parse(request.body.read)
    access_token = get_access_token
    
    refund_payload = {
      amount: {
        value: request_body['amount'],
        currency_code: request_body['currency'] || 'USD'
      }
    }
    
    refund_payload[:note_to_payer] = request_body['note'] if request_body['note']
    refund_payload[:invoice_id] = request_body['invoiceId'] if request_body['invoiceId']
    
    uri = URI.parse("#{PAYPAL_BASE}/v2/payments/captures/#{capture_id}/refund")
    http = Net::HTTP.new(uri.host, uri.port)
    http.use_ssl = true
    
    request = Net::HTTP::Post.new(uri.path)
    request['Content-Type'] = 'application/json'
    request['Authorization'] = "Bearer #{access_token}"
    request['PayPal-Request-Id'] = SecureRandom.uuid
    request.body = refund_payload.to_json
    
    response = http.request(request)
    refund_data = JSON.parse(response.body)
    
    {
      refundId: refund_data['id'],
      status: refund_data['status'],
      amount: refund_data['amount'],
      details: refund_data
    }.to_json
  rescue => e
    status 500
    { error: 'REFUND_FAILED' }.to_json
  end
end
```

#### Get Refund Details

```ruby
get '/paypal-api/payments/refunds/:refund_id' do
  content_type :json
  
  begin
    refund_id = params[:refund_id]
    access_token = get_access_token
    
    uri = URI.parse("#{PAYPAL_BASE}/v2/payments/refunds/#{refund_id}")
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

#### Get Order Details for Refund

```ruby
get '/paypal-api/checkout/orders/:order_id/details' do
  content_type :json
  
  begin
    order_id = params[:order_id]
    access_token = get_access_token
    
    uri = URI.parse("#{PAYPAL_BASE}/v2/checkout/orders/#{order_id}")
    http = Net::HTTP.new(uri.host, uri.port)
    http.use_ssl = true
    
    request = Net::HTTP::Get.new(uri.path)
    request['Content-Type'] = 'application/json'
    request['Authorization'] = "Bearer #{access_token}"
    
    response = http.request(request)
    order_data = JSON.parse(response.body)
    
    captures = order_data.dig('purchase_units', 0, 'payments', 'captures') || []
    capture_id = captures.first&.dig('id')
    
    {
      orderId: order_id,
      captureId: capture_id,
      status: order_data['status'],
      details: order_data
    }.to_json
  rescue => e
    status 500
    { error: 'FETCH_FAILED' }.to_json
  end
end
```

