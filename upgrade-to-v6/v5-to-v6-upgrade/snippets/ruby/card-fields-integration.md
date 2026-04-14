# Card Fields Integration (Server-Side)

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

post '/paypal-api/checkout/orders/create-card-fields' do
  content_type :json
  
  begin
    request_body = JSON.parse(request.body.read)
    access_token = get_access_token
    
    amount = request_body['amount']
    currency = request_body['currency'] || 'USD'
    verification_method = request_body['verification_method'] || 'SCA_WHEN_REQUIRED'
    
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
              method: verification_method
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

post '/paypal-api/checkout/orders/confirm-payment-source' do
  content_type :json
  
  begin
    request_body = JSON.parse(request.body.read)
    order_id = request_body['orderId']
    
    if order_id.nil? || order_id.empty?
      status 400
      return {
        error: 'MISSING_ORDER_ID',
        message: 'orderId is required'
      }.to_json
    end
    
    access_token = get_access_token
    
    payload = {
      payment_source: {
        card: {
          single_use_token: request_body['single_use_token']
        }
      }
    }
    
    uri = URI.parse("#{PAYPAL_BASE_URL}/v2/checkout/orders/#{order_id}/confirm-payment-source")
    http = Net::HTTP.new(uri.host, uri.port)
    http.use_ssl = true
    
    request = Net::HTTP::Post.new(uri.path)
    request['Content-Type'] = 'application/json'
    request['Authorization'] = "Bearer #{access_token}"
    request['PayPal-Request-Id'] = SecureRandom.uuid
    request.body = payload.to_json
    
    response = http.request(request)
    
    status response.code.to_i
    response.body
    
  rescue => e
    status 500
    { error: 'CONFIRMATION_FAILED' }.to_json
  end
end
```

