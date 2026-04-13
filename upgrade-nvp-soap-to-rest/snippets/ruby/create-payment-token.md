#### Exchanging temporary setup token for a payment token

```rb
# `setup_token_id` is the setup token created with the `POST /v3/vault/setup-tokens` call.
def create_payment_token(setup_token_id)
  access_token = get_paypal_access_token

  url_str = "#{$paypal_base_url}/v3/vault/payment-tokens"
  url = URI(url_str)

  payload = {
    'payment_source' => {
      'token' => {
        'id' => setup_token_id,
        'type' => 'SETUP_TOKEN'
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

  JSON.parse(response.body)
rescue StandardError => e
  puts "Error in create_payment_token: #{e.message}"
  raise e
end
```