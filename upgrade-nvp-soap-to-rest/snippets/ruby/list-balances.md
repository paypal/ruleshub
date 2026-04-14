#### List all balances

```rb
def list_all_balances
  # Lists all balances.
  access_token = get_paypal_access_token

  url = "#{$paypal_base_url}/v1/reporting/balances"
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
  puts "Error in list_all_balances: #{e.message}"
  raise e
end
```

> Note:When *RETURNALLCURRENCIES=0* in NVP, or *<ebl:ReturnAllCurrencies>false</ebl:ReturnAllCurrencies>* in SOAP, omit *currency_code* (or set it to your primary currency, e.g., USD).
