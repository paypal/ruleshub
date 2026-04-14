#### Capturing full authorized amount

> Note: Use the capture authorization endpoint with an empty request body to capture the entire authorized amount and treat it as the final capture.

```rb
def capture_authorization(authorization_id)
  # Captures a payment for an order.
  access_token = get_paypal_access_token

  url = "#{$paypal_base_url}/v2/payments/authorizations/#{authorization_id}/capture"
  uri = URI(url)
  request = Net::HTTP::Post.new(uri)
  request['Authorization'] = "Bearer #{access_token}"
  request['PayPal-Request-Id'] = SecureRandom.uuid
  request['Content-Type'] = 'application/json'
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
  JSON.parse(response.body)
rescue StandardError => e
  puts "Error in capture_authorization: #{e.message}"
  raise e
end
```

#### Capturing part of the authorized amount

> Note: For partial captures, specify amount to be captured and set "final_capture" explicitly to false.

```rb
def capture_authorization_partial(authorization_id, amount, final_capture = true)
  # Captures a partial payment for an order.
  access_token = get_paypal_access_token

  url = "#{$paypal_base_url}/v2/payments/authorizations/#{authorization_id}/capture"
  uri = URI(url)
  request = Net::HTTP::Post.new(uri)
  request['Authorization'] = "Bearer #{access_token}"
  request['PayPal-Request-Id'] = SecureRandom.uuid
  request['Content-Type'] = 'application/json'

  payload = {
    'amount' => {
      'currency_code' => 'USD', # Legacy equivalents — NVP: CURRENCYCODE; SOAP: Amount.currencyID
      'value' => amount # Legacy equivalents — NVP: AMT; SOAP: Amount
    },
    'final_capture' => final_capture # Legacy equivalents — NVP: COMPLETETYPE; SOAP: CompleteType
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
  response_data['id'] # Returns the ID assigned for the captured payment.
rescue StandardError => e
  puts "Error in capture_authorization_partial: #{e.message}"
  raise e
end
```