#### OAuth2.0 Authentication

```rb
$token_cache = {}

# Helper: a properly configured HTTPS client
def https_client_for(uri)
  u = URI(uri)
  http = Net::HTTP.new(u.host, u.port)
  http.use_ssl = true
  # Enforce TLS1.2+ (Ruby/OpenSSL will negotiate highest supported)
  http.min_version = OpenSSL::SSL::TLS1_2_VERSION

  # Verify server certificate + hostname
  http.verify_mode = OpenSSL::SSL::VERIFY_PEER

  # Use system CA store (recommended). Falls back to OS trust.
  store = OpenSSL::X509::Store.new
  store.set_default_paths
  http.cert_store = store
  
  http
end

def get_paypal_access_token
  # Fetches a PayPal access token, caching it for reuse.
  cached_token = $token_cache['access_token']
  if cached_token && cached_token['expires'] > Time.now.to_i
    return cached_token['token']
  end

  client_id = ENV['PAYPAL_CLIENT_ID']
  client_secret = ENV['PAYPAL_CLIENT_SECRET']

  if !client_id || !client_secret
    raise 'PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET environment variables must be set.'
  end

  auth = Base64.strict_encode64("#{client_id}:#{client_secret}")

  url = "#{$paypal_base_url}/v1/oauth2/token"
  uri = URI(url)
  request = Net::HTTP::Post.new(uri)
  request['Authorization'] = "Basic #{auth}"
  request['Content-Type'] = 'application/x-www-form-urlencoded'
  request['PayPal-Request-Id'] = SecureRandom.uuid
  request.body = 'grant_type=client_credentials'
  http = https_client_for(url)
  response = http.request(request)

  if response.code.to_i >= 400
    begin
      error_data = JSON.parse(response.body)
      puts "Error debug id: #{error_data['debug_id']}"
    rescue JSON::ParserError
      puts "Error getting debug id from response: #{response.body}"
    end
    raise "Request failed with status #{response.code}"
  end

  token_data = JSON.parse(response.body)

  $token_cache['access_token'] = {
    'token' => token_data['access_token'],
    'expires' => Time.now.to_i + token_data['expires_in'] - 60  # 1 minute buffer
  }

  token_data['access_token']
rescue StandardError => e
  puts "Error in get_paypal_access_token: #{e.message}"
  raise e
end
```