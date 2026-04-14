# Client Token Generation (Server-Side)

## Sinatra Implementation

```ruby
PAYPAL_CLIENT_ID = ENV['PAYPAL_CLIENT_ID']
PAYPAL_CLIENT_SECRET = ENV['PAYPAL_CLIENT_SECRET']
PAYPAL_BASE_URL = ENV['PAYPAL_BASE_URL'] || 'https://api-m.sandbox.paypal.com'

$cached_token = nil
$token_expiration = nil

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

get '/paypal-api/auth/browser-safe-client-token' do
  content_type :json
  
  begin
    if $cached_token && $token_expiration && Time.now < $token_expiration
      expires_in = ($token_expiration - Time.now).to_i
      return {
        accessToken: $cached_token,
        expiresIn: expires_in
      }.to_json
    end
    
    auth = Base64.strict_encode64("#{PAYPAL_CLIENT_ID}:#{PAYPAL_CLIENT_SECRET}")
    
    uri = URI.parse("#{PAYPAL_BASE_URL}/v1/oauth2/token")
    http = Net::HTTP.new(uri.host, uri.port)
    http.use_ssl = true
    
    request = Net::HTTP::Post.new(uri.path)
    request['Authorization'] = "Basic #{auth}"
    request['Content-Type'] = 'application/x-www-form-urlencoded'
    request.body = 'grant_type=client_credentials&response_type=client_token&intent=sdk_init'
    
    response = http.request(request)
    token_data = JSON.parse(response.body)
    
    access_token = token_data['access_token']
    expires_in = token_data['expires_in'] || 900
    
    $cached_token = access_token
    $token_expiration = Time.now + expires_in - 120
    
    {
      accessToken: access_token,
      expiresIn: expires_in
    }.to_json
  rescue => e
    status 500
    { error: 'TOKEN_GENERATION_FAILED', message: 'Failed to generate client token' }.to_json
  end
end
```

## Environment Variables (.env)

```bash
PAYPAL_CLIENT_ID=your_client_id_here
PAYPAL_CLIENT_SECRET=your_client_secret_here
PAYPAL_BASE_URL=https://api-m.sandbox.paypal.com
```

