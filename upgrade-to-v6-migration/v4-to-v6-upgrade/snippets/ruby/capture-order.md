#### Capture Order

```ruby
require 'sinatra'
require 'net/http'
require 'uri'
require 'json'
require 'securerandom'

post '/paypal-api/checkout/orders/:order_id/capture' do
  content_type :json
  
  begin
    order_id = params[:order_id]
    access_token = get_access_token
    
    uri = URI.parse("#{PAYPAL_BASE}/v2/checkout/orders/#{order_id}/capture")
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
    { error: 'CAPTURE_FAILED' }.to_json
  end
end
```

