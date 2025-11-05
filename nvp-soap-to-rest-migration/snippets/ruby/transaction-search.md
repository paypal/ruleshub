#### Finding Transactions with TransactionID (legacy `GetTransactionDetails`)

```rb
def view_transaction(transaction_id)
  # Views a specific transaction.
  access_token = get_paypal_access_token

  now = Time.now.utc
  start_time = now - (7 * 24 * 60 * 60)  # 7 days ago
  end_time = now - (24 * 60 * 60)        # 1 day ago

  url = "#{$paypal_base_url}/v1/reporting/transactions"
  uri = URI(url)
  uri.query = URI.encode_www_form(
    'start_date' => start_time.iso8601, # Legacy equivalents — NVP: STARTDATE ; SOAP: StartDate
    'end_date' => end_time.iso8601, # Legacy equivalents — NVP: ENDDATE ; SOAP: EndDate
    'transaction_id' => transaction_id # Legacy equivalents — NVP: TRANSACTIONID ; SOAP: TransactionID
  )

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
  puts "Error in view_transaction: #{e.message}"
  raise e
end
```

#### Searching Transactions between a start date and end date (legacy `TransactionSearch`)

```rb
def transaction_search
  # Searches for transactions.
  access_token = get_paypal_access_token
  now = Time.now.utc
  start_time = now - (7 * 24 * 60 * 60)  # 7 days ago
  end_time = now - (24 * 60 * 60)        # 1 day ago

  url = "#{$paypal_base_url}/v1/reporting/transactions"
  uri = URI(url)
  uri.query = URI.encode_www_form(
    'start_date' => start_time.iso8601, # Legacy equivalents — NVP: STARTDATE ; SOAP: StartDate
    'end_date' => end_time.iso8601 # Legacy equivalents — NVP: ENDDATE ; SOAP: EndDate
  )

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
  puts "Error in transaction_search: #{e.message}"
  raise e
end
```