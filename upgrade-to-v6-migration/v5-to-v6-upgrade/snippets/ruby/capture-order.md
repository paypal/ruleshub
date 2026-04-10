# Capture Order (Server-Side)

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

post '/paypal-api/checkout/orders/:order_id/capture' do
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
    
    get_request = Net::HTTP::Get.new(uri.path)
    get_request['Authorization'] = "Bearer #{access_token}"
    
    order_response = http.request(get_request)
    
    if order_response.code.to_i != 200
      status 404
      return { error: 'ORDER_NOT_FOUND', message: 'Order not found' }.to_json
    end
    
    order_data = JSON.parse(order_response.body)
    
    if order_data['status'] != 'APPROVED'
      status 400
      return {
        error: 'ORDER_NOT_APPROVED',
        message: "Order status is #{order_data['status']}, not APPROVED",
        orderId: order_id
      }.to_json
    end
    
    capture_uri = URI.parse("#{PAYPAL_BASE_URL}/v2/checkout/orders/#{order_id}/capture")
    capture_http = Net::HTTP.new(capture_uri.host, capture_uri.port)
    capture_http.use_ssl = true
    
    capture_request = Net::HTTP::Post.new(capture_uri.path)
    capture_request['Content-Type'] = 'application/json'
    capture_request['Authorization'] = "Bearer #{access_token}"
    capture_request['PayPal-Request-Id'] = SecureRandom.uuid
    capture_request.body = {}.to_json
    
    capture_response = capture_http.request(capture_request)
    capture_data = JSON.parse(capture_response.body)
    
    if capture_response.code.to_i == 422
      status 422
      return {
        error: 'ORDER_ALREADY_CAPTURED',
        message: 'Order cannot be captured'
      }.to_json
    end
    
    if capture_response.code.to_i != 201
      status capture_response.code.to_i
      return {
        error: 'CAPTURE_FAILED',
        message: 'Failed to capture order'
      }.to_json
    end
    
    capture = capture_data['purchase_units'][0]['payments']['captures'][0]
    
    {
      id: capture_data['id'],
      status: capture_data['status'],
      captureId: capture['id'],
      amount: capture['amount'],
      payer: capture_data['payer'],
      create_time: capture['create_time']
    }.to_json
    
  rescue => e
    status 500
    { error: 'CAPTURE_FAILED', message: 'Failed to capture order' }.to_json
  end
end
```

