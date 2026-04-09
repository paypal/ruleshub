#### Create a new setup token

```rb
def create_setup_token
  access_token = get_paypal_access_token
  url_str = "#{$paypal_base_url}/v3/vault/setup-tokens"
  url = URI(url_str)
  payload = {
    'payment_source' => {
      'paypal' => {
        'experience_context' => {
          'shipping_preference' => 'SET_PROVIDED_ADDRESS', # Legacy equivalents — NVP: ADDROVERRIDE; SOAP: AddressOverride
          'brand_name' => 'EXAMPLE INC', # Legacy equivalents — NVP: BRANDNAME; SOAP: BrandName
          'locale' => 'en-US', # Legacy equivalents — NVP: LOCALECODE; SOAP: LocaleCode
          'return_url' => 'https://example.com/returnUrl', # Legacy equivalents — NVP: RETURNURL; SOAP: ReturnURL
          'cancel_url' => 'https://example.com/cancelUrl' # Legacy equivalents — NVP: CANCELURL; SOAP: CancelURL
        },
        'usage_pattern' => 'IMMEDIATE', # Only available in REST APIs
        'usage_type' => 'MERCHANT' # Only available in REST APIs
      }
    }
  }
  request = Net::HTTP::Post.new(url)
  request['Content-Type'] = 'application/json'
  request['Authorization'] = "Bearer #{access_token}"
  request['PayPal-Request-Id'] = SecureRandom.uuid
  request.body = payload.to_json
  http = https_client_for(url_str)
  response = http.request(request)
  if response.code.to_i >= 400
    begin
      error_data = JSON.parse(response.body)
      puts "Error debug id: #{error_data['debug_id']}"
    rescue JSON::ParserError
      puts "Error debug id: N/A"
    end
    raise "Request failed with status #{response.code}"
  end
  json_response = JSON.parse(response.body)
  setup_token_id = json_response['id']
  approval_url = nil
  if json_response['links']
    json_response['links'].each do |link|
      if link['rel'] == 'approve'
        approval_url = link['href']
        break
      end
    end
  end

  { 'setup_token_id' => setup_token_id, 'approval_url' => approval_url }
rescue StandardError => e
  puts "Error in create_setup_token: #{e.message}"
  raise e
end
```