#### Refund the pending captured amount

> Note: Send an empty request body to initiate a refund for the amount equal to [captured amount – refunds already issued].

```rb
def refund_transaction(transaction_id)
  # Refunds a transaction.
  access_token = get_paypal_access_token

  url = "#{$paypal_base_url}/v2/payments/captures/#{transaction_id}/refund"
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
  puts "Error in refund_transaction: #{e.message}"
  raise e
end
```

#### Refund specific amount

> Note: Include the specific amount in the request body to initiate a refund for that amount against the capture.

```rb
def refund_transaction_partial(transaction_id, amount)
  # Refunds a partial transaction.
  access_token = get_paypal_access_token

  url = "#{$paypal_base_url}/v2/payments/captures/#{transaction_id}/refund"
  uri = URI(url)
  request = Net::HTTP::Post.new(uri)
  request['Content-Type'] = 'application/json'
  request['Authorization'] = "Bearer #{access_token}"
  request['PayPal-Request-Id'] = SecureRandom.uuid

  payload = {
    'amount' => {
      'currency_code' => 'USD', # Legacy equivalents — NVP: CURRENCYCODE ; SOAP: Amount.currencyID
      'value' => amount # Legacy equivalents — NVP: AMT ; SOAP: Amount
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
  puts "Error in refund_transaction_partial: #{e.message}"
  raise e
end
```