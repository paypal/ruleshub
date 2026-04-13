# 3D Secure Integration (Server-Side)

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

post '/paypal-api/checkout/orders/create-3ds' do
  content_type :json
  
  begin
    request_body = JSON.parse(request.body.read)
    access_token = get_access_token
    
    amount = request_body['amount']
    currency = request_body['currency'] || 'USD'
    sca_method = request_body['scaMethod'] || 'SCA_ALWAYS'
    
    order_payload = {
      intent: 'CAPTURE',
      purchase_units: [{
        amount: {
          currency_code: currency,
          value: '%.2f' % amount.to_f
        }
      }],
      payment_source: {
        card: {
          attributes: {
            verification: {
              method: sca_method
            }
          },
          experience_context: {
            return_url: request_body['return_url'] || 'https://example.com/returnUrl',
            cancel_url: request_body['cancel_url'] || 'https://example.com/cancelUrl'
          }
        }
      }
    }
    
    uri = URI.parse("#{PAYPAL_BASE_URL}/v2/checkout/orders")
    http = Net::HTTP.new(uri.host, uri.port)
    http.use_ssl = true
    
    req = Net::HTTP::Post.new(uri.path)
    req['Content-Type'] = 'application/json'
    req['Authorization'] = "Bearer #{access_token}"
    req['PayPal-Request-Id'] = SecureRandom.uuid
    req.body = order_payload.to_json
    
    response = http.request(req)
    
    status response.code.to_i
    response.body
    
  rescue => e
    status 500
    { error: 'ORDER_CREATION_FAILED' }.to_json
  end
end

post '/paypal-api/checkout/orders/:order_id/capture-3ds' do
  content_type :json
  
  begin
    order_id = params[:order_id]
    access_token = get_access_token
    
    uri = URI.parse("#{PAYPAL_BASE_URL}/v2/checkout/orders/#{order_id}/capture")
    http = Net::HTTP.new(uri.host, uri.port)
    http.use_ssl = true
    
    request = Net::HTTP::Post.new(uri.path)
    request['Content-Type'] = 'application/json'
    request['Authorization'] = "Bearer #{access_token}"
    request['PayPal-Request-Id'] = SecureRandom.uuid
    request.body = {}.to_json
    
    response = http.request(request)
    capture_data = JSON.parse(response.body)
    
    if response.code.to_i == 201
      auth_result = capture_data.dig('payment_source', 'card', 'authentication_result')
      
      if auth_result
        three_ds = auth_result['three_d_secure']
        
        puts '3DS Authentication Result:'
        puts "  Order ID: #{capture_data['id']}"
        puts "  Liability Shift: #{auth_result['liability_shift']}"
        puts "  Auth Status: #{three_ds&.dig('authentication_status')}"
        puts "  Enrollment Status: #{three_ds&.dig('enrollment_status')}"
      end
    end
    
    status response.code.to_i
    response.body
    
  rescue => e
    status 500
    { error: 'CAPTURE_FAILED' }.to_json
  end
end
```

