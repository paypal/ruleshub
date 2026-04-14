#### Capturing payment for an Order

> Note: Always have an empty payload as request body while capturing payment for an order.

```rb
def capture_order(order_id)
  # Captures a payment for an order.
  access_token = get_paypal_access_token

  url = "#{$paypal_base_url}/v2/checkout/orders/#{order_id}/capture"
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

  response_data = JSON.parse(response.body)
  puts "Capture details for Order ID: #{order_id}"
  puts response_data

  response_data['purchase_units'][0]['payments']['captures'][0]['id']
rescue StandardError => e
  puts "Error in capture_order: #{e.message}"
  raise e
end
```

#### Authorizing an Order

```rb
def authorize_order(order_id)
  # Authorizes a payment for an order.
  access_token = get_paypal_access_token

  url = "#{$paypal_base_url}/v2/checkout/orders/#{order_id}/authorize"
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
  response_data['purchase_units'][0]['payments']['authorizations'][0]['id']
rescue StandardError => e
  puts "Error in authorize_order: #{e.message}"
  raise e
end
```