#### Void Authorization

```ruby
require 'sinatra'
require 'net/http'
require 'uri'
require 'json'
require 'securerandom'

post '/paypal-api/payments/authorizations/:authorization_id/void' do
  content_type :json
  
  begin
    authorization_id = params[:authorization_id]
    access_token = get_access_token
    
    uri = URI.parse("#{PAYPAL_BASE}/v2/payments/authorizations/#{authorization_id}/void")
    http = Net::HTTP.new(uri.host, uri.port)
    http.use_ssl = true
    
    request = Net::HTTP::Post.new(uri.path)
    request['Content-Type'] = 'application/json'
    request['Authorization'] = "Bearer #{access_token}"
    request['PayPal-Request-Id'] = SecureRandom.uuid
    request.body = {}.to_json
    
    response = http.request(request)
    
    {
      success: true,
      authorizationId: authorization_id,
      status: 'VOIDED'
    }.to_json
  rescue => e
    status 500
    { error: 'VOID_FAILED' }.to_json
  end
end
```

