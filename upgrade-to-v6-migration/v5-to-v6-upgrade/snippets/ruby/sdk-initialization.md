# SDK Initialization (Server Support)

## Sinatra Implementation

```ruby
set :port, 3000
set :bind, '0.0.0.0'
set :public_folder, 'public'

PAYPAL_CLIENT_ID = ENV['PAYPAL_CLIENT_ID']
PAYPAL_CLIENT_SECRET = ENV['PAYPAL_CLIENT_SECRET']
PAYPAL_BASE_URL = ENV['PAYPAL_BASE_URL'] || 'https://api-m.sandbox.paypal.com'

$cached_token = nil
$token_expiration = nil

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
    { error: 'TOKEN_GENERATION_FAILED' }.to_json
  end
end

get '/' do
  send_file File.join(settings.public_folder, 'index.html')
end
```

## HTML Template (public/index.html)

```html
<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>PayPal v6 Integration</title>
</head>
<body>
  <h1>PayPal v6 Checkout</h1>
  
  <div id="loading" class="loading">
    <p>Loading payment options...</p>
  </div>
  
  <div id="error" class="error" style="display:none;">
    <p id="error-message"></p>
  </div>
  
  <div class="buttons-container">
    <paypal-button 
      id="paypal-button" 
      type="pay" 
      class="paypal-gold" 
      hidden>
    </paypal-button>
  </div>
  
  <script src="app.js"></script>
  <script 
    async 
    src="https://www.sandbox.paypal.com/web-sdk/v6/core" 
    onload="onPayPalWebSdkLoaded()">
  </script>
</body>
</html>
```

## Environment Variables (.env)

```bash
PAYPAL_CLIENT_ID=your_client_id_here
PAYPAL_CLIENT_SECRET=your_client_secret_here
PAYPAL_BASE_URL=https://api-m.sandbox.paypal.com
```

