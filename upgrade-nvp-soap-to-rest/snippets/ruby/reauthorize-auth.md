#### Reauthorizing the full amount that was authorized before

> Note: Sending a reauthorization request with an empty body will reauthorize the full amount of the previously authorized order.

```rb
# The authorizationId parameter must be the original identifier returned when the order was first authorized.
def reauthorize_auth(authorization_id)
  # Reauthorizes a payment.
  access_token = get_paypal_access_token

  url = "#{$paypal_base_url}/v2/payments/authorizations/#{authorization_id}/reauthorize"
  uri = URI(url)
  request = Net::HTTP::Post.new(uri)
  request['Content-Type'] = 'application/json'
  request['Authorization'] = "Bearer #{access_token}"
  request['PayPal-Request-Id'] = SecureRandom.uuid
  request.body = '{}'
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

  response_data = JSON.parse(response.body)
  response_data['id']
rescue StandardError => e
  puts "Error in reauthorize_auth: #{e.message}"
  raise e
end
```

#### Reauthorizing part of the amount that was authorized before

> Note: Include the amount field in the reauthorization request body to reauthorize a specific amount, which must not exceed the originally authorized value.

```rb
def reauthorize_auth_partial(authorization_id, amount)
  # Reauthorizes a partial payment.
  access_token = get_paypal_access_token

  url = "#{$paypal_base_url}/v2/payments/authorizations/#{authorization_id}/reauthorize"
  uri = URI(url)
  request = Net::HTTP::Post.new(uri)
  request['Content-Type'] = 'application/json'
  request['Authorization'] = "Bearer #{access_token}"
  request['PayPal-Request-Id'] = SecureRandom.uuid

  payload = {
    'amount' => {
      'currency_code' => 'USD', # Legacy equivalents — NVP: CURRENCYCODE; SOAP: Not Supported
      'value' => amount # Legacy equivalents — NVP: AMT; SOAP: Amount
    }
  }

  request.body = payload.to_json
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

  response_data = JSON.parse(response.body)
  response_data['id']
rescue StandardError => e
  puts "Error in reauthorize_auth_partial: #{e.message}"
  raise e
end
```