# Create Order (Server-Side)

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

post '/paypal-api/checkout/orders/create' do
  content_type :json
  
  begin
    request_body = JSON.parse(request.body.read)
    
    amount = request_body['amount']
    currency = request_body['currency'] || 'USD'
    
    if amount.nil? || amount.to_f <= 0
      status 400
      return {
        error: 'INVALID_AMOUNT',
        message: 'Invalid or missing amount'
      }.to_json
    end
    
    access_token = get_access_token
    
    order_payload = {
      intent: 'CAPTURE',
      purchase_units: [{
        amount: {
          currency_code: currency,
          value: '%.2f' % amount.to_f
        }
      }]
    }
    
    order_payload[:purchase_units][0][:description] = request_body['description'] if request_body['description']
    order_payload[:purchase_units][0][:custom_id] = request_body['custom_id'] if request_body['custom_id']
    order_payload[:purchase_units][0][:invoice_id] = request_body['invoice_id'] if request_body['invoice_id']
    
    order_payload[:payment_source] = {
      paypal: {
        experience_context: {
          payment_method_preference: 'IMMEDIATE_PAYMENT_REQUIRED',
          brand_name: 'Your Store Name',
          locale: 'en-US',
          landing_page: 'LOGIN',
          shipping_preference: 'NO_SHIPPING',
          user_action: 'PAY_NOW',
          return_url: "#{request.base_url}/success",
          cancel_url: "#{request.base_url}/cancel"
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
    order_data = JSON.parse(response.body)
    
    status response.code.to_i
    {
      id: order_data['id'],
      status: order_data['status'],
      links: order_data['links']
    }.to_json
    
  rescue => e
    status 500
    { error: 'ORDER_CREATION_FAILED', message: 'Failed to create order' }.to_json
  end
end
```

