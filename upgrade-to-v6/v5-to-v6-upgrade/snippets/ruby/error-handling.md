# Error Handling (Server-Side)

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

def log_paypal_error(operation, debug_id, status_code, error_body)
  puts 'PayPal API Error:'
  puts "  Operation: #{operation}"
  puts "  Debug ID: #{debug_id}"
  puts "  Status Code: #{status_code}"
  puts "  Error Body: #{error_body}"
end

def handle_validation_error(error_data, debug_id)
  {
    error: 'VALIDATION_ERROR',
    debugId: debug_id,
    message: 'Invalid request data'
  }
end

def handle_authentication_error(debug_id)
  {
    error: 'AUTHENTICATION_FAILED',
    debugId: debug_id,
    message: 'Invalid or expired credentials'
  }
end

def handle_payment_error(error_data, debug_id)
  {
    error: 'PAYMENT_ERROR',
    debugId: debug_id,
    message: 'Payment could not be processed'
  }
end

post '/paypal-api/checkout/orders/create-with-error-handling' do
  content_type :json
  
  begin
    request_body = JSON.parse(request.body.read)
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
      }]
    }
    
    uri = URI.parse("#{PAYPAL_BASE_URL}/v2/checkout/orders")
    http = Net::HTTP.new(uri.host, uri.port)
    http.use_ssl = true
    
    req = Net::HTTP::Post.new(uri.path)
    req['Content-Type'] = 'application/json'
    req['Authorization'] = "Bearer #{access_token}"
    req.body = order_payload.to_json
    
    response = http.request(req)
    
    if response.code.to_i == 200 || response.code.to_i == 201
      return response.body
    end
    
    debug_id = response['PayPal-Debug-Id'] || 'N/A'
    error_data = JSON.parse(response.body)
    
    log_paypal_error('create_order', debug_id, response.code.to_i, response.body)
    
    result = case response.code.to_i
    when 400
      handle_validation_error(error_data, debug_id)
    when 401
      handle_authentication_error(debug_id)
    when 422
      handle_payment_error(error_data, debug_id)
    else
      {
        error: 'ORDER_CREATION_FAILED',
        debugId: debug_id,
        message: 'Failed to create order'
      }
    end
    
    status response.code.to_i
    result.to_json
    
  rescue => e
    puts "Unexpected error: #{e.message}"
    status 500
    { error: 'INTERNAL_ERROR', message: 'An unexpected error occurred' }.to_json
  end
end

error 400 do
  content_type :json
  { error: 'BAD_REQUEST', message: 'Invalid request data' }.to_json
end

error 404 do
  content_type :json
  { error: 'NOT_FOUND', message: 'Resource not found' }.to_json
end

error 500 do
  content_type :json
  { error: 'INTERNAL_SERVER_ERROR', message: 'An internal error occurred' }.to_json
end
```

