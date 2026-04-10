# Get Order Details (Server-Side)

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

get '/paypal-api/checkout/orders/:order_id' do
  content_type :json
  
  begin
    order_id = params[:order_id]
    
    if order_id.nil? || order_id.empty?
      status 400
      return { error: 'INVALID_ORDER_ID', message: 'Order ID is required' }.to_json
    end
    
    access_token = get_access_token
    
    uri = URI.parse("#{PAYPAL_BASE_URL}/v2/checkout/orders/#{order_id}")
    http = Net::HTTP.new(uri.host, uri.port)
    http.use_ssl = true
    
    request = Net::HTTP::Get.new(uri.path)
    request['Authorization'] = "Bearer #{access_token}"
    request['Content-Type'] = 'application/json'
    
    response = http.request(request)
    
    if response.code.to_i == 404
      status 404
      return { error: 'ORDER_NOT_FOUND', message: 'Order not found' }.to_json
    end
    
    if response.code.to_i != 200
      status response.code.to_i
      return { error: 'FETCH_FAILED', message: 'Failed to fetch order' }.to_json
    end
    
    response.body
    
  rescue => e
    status 500
    { error: 'FETCH_FAILED', message: 'Failed to fetch order details' }.to_json
  end
end

get '/paypal-api/checkout/orders/:order_id/summary' do
  content_type :json
  
  begin
    order_id = params[:order_id]
    access_token = get_access_token
    
    uri = URI.parse("#{PAYPAL_BASE_URL}/v2/checkout/orders/#{order_id}")
    http = Net::HTTP.new(uri.host, uri.port)
    http.use_ssl = true
    
    request = Net::HTTP::Get.new(uri.path)
    request['Authorization'] = "Bearer #{access_token}"
    
    response = http.request(request)
    
    if response.code.to_i != 200
      status 404
      return { error: 'ORDER_NOT_FOUND' }.to_json
    end
    
    order_data = JSON.parse(response.body)
    
    captures = order_data.dig('purchase_units', 0, 'payments', 'captures') || []
    authorizations = order_data.dig('purchase_units', 0, 'payments', 'authorizations') || []
    
    summary = {
      id: order_data['id'],
      status: order_data['status'],
      amount: order_data['purchase_units'][0]['amount'],
      payer: order_data['payer'],
      captureId: captures.first&.dig('id'),
      authorizationId: authorizations.first&.dig('id'),
      create_time: order_data['create_time'],
      update_time: order_data['update_time']
    }
    
    summary.to_json
    
  rescue => e
    status 500
    { error: 'FETCH_FAILED' }.to_json
  end
end
```

