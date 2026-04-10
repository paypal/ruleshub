#### Enhanced Error Handling with Debug IDs

```ruby
require 'sinatra'
require 'net/http'
require 'uri'
require 'json'
require 'securerandom'

post '/paypal-api/checkout/orders/create-with-error-handling' do
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
    
    if response.is_a?(Net::HTTPSuccess)
      return response.body
    end
    
    debug_id = response['PayPal-Debug-Id'] || 'N/A'
    error_data = JSON.parse(response.body)
    
    puts "Order creation failed - Debug ID: #{debug_id}"
    puts "Status: #{response.code}"
    puts "Error: #{error_data}"
    
    status response.code.to_i
    {
      error: 'ORDER_CREATION_FAILED',
      debugId: debug_id,
      status: response.code.to_i,
      details: error_data['details'] || [],
      message: error_data['message'] || 'Failed to create order'
    }.to_json
  rescue => e
    puts "Unexpected error: #{e.message}"
    status 500
    {
      error: 'INTERNAL_ERROR',
      message: 'An unexpected error occurred'
    }.to_json
  end
end
```

#### Error Handler Module

```ruby
module PayPalErrorHandler
  def handle_error(response)
    debug_id = response['PayPal-Debug-Id'] || 'N/A'
    error_data = JSON.parse(response.body) rescue {}
    
    puts "PayPal API Error - Debug ID: #{debug_id}"
    puts "Status: #{response.code}"
    puts "Details: #{error_data}"
    
    {
      error: error_data['name'] || 'API_ERROR',
      debugId: debug_id,
      message: error_data['message'] || 'PayPal API error',
      details: error_data['details'] || []
    }
  end
end
```

#### Specific Error Handlers

```ruby
module PayPalErrorUtils
  def self.handle_validation_error(error_data, debug_id)
    field_errors = (error_data['details'] || []).map do |detail|
      {
        field: detail['field'],
        issue: detail['issue'],
        description: detail['description']
      }
    end
    
    {
      error: 'VALIDATION_ERROR',
      debugId: debug_id,
      message: 'Invalid request data',
      fieldErrors: field_errors
    }
  end

  def self.handle_authentication_error(debug_id)
    {
      error: 'AUTHENTICATION_FAILED',
      debugId: debug_id,
      message: 'Invalid or expired credentials'
    }
  end

  def self.handle_payment_error(error_data, debug_id)
    error_name = error_data['name'] || ''
    user_message = 'Payment could not be processed'
    
    if error_name.include?('INSTRUMENT_DECLINED')
      user_message = 'Payment method was declined. Please try another payment method.'
    elsif error_name.include?('INSUFFICIENT_FUNDS')
      user_message = 'Insufficient funds. Please try another payment method.'
    elsif error_name.include?('ORDER_NOT_APPROVED')
      user_message = 'Order was not approved. Please try again.'
    end
    
    {
      error: error_name,
      debugId: debug_id,
      message: user_message,
      details: error_data['details'] || []
    }
  end
end
```

#### Error Logger

```ruby
module PayPalErrorLogger
  def self.log_error(operation, debug_id, status_code, error_data, request_data = nil)
    puts "PayPal API Error:"
    puts "  Operation: #{operation}"
    puts "  Debug ID: #{debug_id}"
    puts "  Status Code: #{status_code}"
    puts "  Error Name: #{error_data['name']}"
    puts "  Error Message: #{error_data['message']}"
    puts "  Error Details: #{error_data['details']}"
    puts "  Request Data: #{request_data}" if request_data
    
    debug_id
  end
end

post '/paypal-api/checkout/orders/create-with-logging' do
  content_type :json
  
  begin
    request_body = JSON.parse(request.body.read)
    access_token = get_access_token
    
    uri = URI.parse("#{PAYPAL_BASE}/v2/checkout/orders")
    http = Net::HTTP.new(uri.host, uri.port)
    http.use_ssl = true
    
    request = Net::HTTP::Post.new(uri.path)
    request['Content-Type'] = 'application/json'
    request['Authorization'] = "Bearer #{access_token}"
    request['PayPal-Request-Id'] = SecureRandom.uuid
    request.body = request_body.to_json
    
    response = http.request(request)
    
    unless response.is_a?(Net::HTTPSuccess)
      debug_id = response['PayPal-Debug-Id'] || 'N/A'
      error_data = JSON.parse(response.body) rescue {}
      
      PayPalErrorLogger.log_error('create_order', debug_id, response.code.to_i, error_data, request_body)
      
      status response.code.to_i
      return {
        error: 'ORDER_CREATION_FAILED',
        debugId: debug_id,
        message: 'Please contact support with this reference number'
      }.to_json
    end
    
    response.body
  rescue => e
    puts "Unexpected error creating order: #{e.message}"
    status 500
    { error: 'INTERNAL_ERROR' }.to_json
  end
end
```

