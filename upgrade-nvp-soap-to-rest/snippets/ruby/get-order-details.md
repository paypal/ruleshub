#### Get Order Details

```rb
def get_order_details(order_id)
  # Retrieves the details of an order.
  access_token = get_paypal_access_token

  url = "#{$paypal_base_url}/v2/checkout/orders/#{order_id}"
  uri = URI(url)
  request = Net::HTTP::Get.new(uri)
  request['Authorization'] = "Bearer #{access_token}"
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
  puts "Error in get_order_details: #{e.message}"
  raise e
end
```