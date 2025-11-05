#### Show user profile details

```rb
def get_user_info
  # Retrieves user information from PayPal.
  access_token = get_paypal_access_token

  url = "#{$paypal_base_url}/v1/identity/openidconnect/userinfo"
  uri = URI(url)
  uri.query = URI.encode_www_form('schema' => 'openid')

  request = Net::HTTP::Get.new(uri)
  request['Authorization'] = "Bearer #{access_token}"
  request['Content-Type'] = 'application/x-www-form-urlencoded'
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
  puts "Error in get_user_info: #{e.message}"
  raise e
end
```