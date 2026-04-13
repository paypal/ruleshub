#### Creating a "CAPTURE" order with vaulted payment

```rb
def capture_reference_transaction(vault_id, amount, currency_code)
  # Creates an order with a reference transaction (e.g., billing agreement)
  # and captures the payment.
  puts 'Creating order for reference transaction...'
  access_token = get_paypal_access_token
  create_order_url_str = "#{$paypal_base_url}/v2/checkout/orders"
  create_order_url = URI(create_order_url_str)
  order_payload = {
    'intent' => 'CAPTURE', # Legacy equivalents — NVP: PAYMENTACTION ; SOAP: PaymentAction
    'purchase_units' => [
      {
        'amount' => {
          'currency_code' => currency_code, # Legacy equivalents — NVP: CURRENCYCODE ; SOAP: PaymentDetails.OrderTotal.currencyID
          'value' => amount # Legacy equivalents — NVP: AMT ; SOAP: PaymentDetails.OrderTotal
        }
      }
    ],
    'payment_source' => {
      'paypal' => {
        'vault_id' => vault_id # Used in place of legacy payload's BILLINGAGREEMENTID.
      }
    }
  }

  request = Net::HTTP::Post.new(create_order_url)
  request['Content-Type'] = 'application/json'
  request['Authorization'] = "Bearer #{access_token}"
  request['PayPal-Request-Id'] = SecureRandom.uuid
  request.body = order_payload.to_json
  http = https_client_for(create_order_url_str)
  response = http.request(request)

  if response.code.to_i >= 400
    puts 'Error in capture_reference_transaction:'
    puts "- Status: #{response.code}"
    begin
      error_data = JSON.parse(response.body)
      puts "- Data: #{JSON.pretty_generate(error_data)}"
      puts "- Debug ID: #{error_data['debug_id']}"
    rescue JSON::ParserError
      puts "- Data: #{response.body}"
    end
    raise "Request failed with status #{response.code}"
  end

  response_data = JSON.parse(response.body)
  order_id = response_data['id']
  puts "Order created with ID: #{order_id}"
  puts "Order details: #{JSON.pretty_generate(response_data)}"

  response_data
rescue StandardError => e
  puts "Error in capture_reference_transaction: #{e.message}"
  raise e
end
```

#### Creating a "AUTHORIZE" order with vaulted payment

```rb
def authorize_and_capture_reference_transaction(vault_id, amount, currency_code)
  # Authorizes and captures a reference transaction.
  puts 'Creating order to authorize reference transaction...'
  access_token = get_paypal_access_token
  create_order_url_str = "#{$paypal_base_url}/v2/checkout/orders"
  create_order_url = URI(create_order_url_str)

  order_payload = {
    'intent' => 'AUTHORIZE', # Legacy equivalents — NVP: PAYMENTACTION ; SOAP: PaymentAction
    'purchase_units' => [
      {
        'amount' => {
          'currency_code' => currency_code, # Legacy equivalents — NVP: CURRENCYCODE ; SOAP: PaymentDetails.OrderTotal.currencyID
          'value' => amount # Legacy equivalents — NVP: AMT ; SOAP: PaymentDetails.OrderTotal
        }
      }
    ],
    'payment_source' => {
      'paypal' => {
        'vault_id' => vault_id # Used in place of legacy payload's BILLINGAGREEMENTID.
      }
    }
  }

  request = Net::HTTP::Post.new(create_order_url)
  request['Content-Type'] = 'application/json'
  request['Authorization'] = "Bearer #{access_token}"
  request['PayPal-Request-Id'] = SecureRandom.uuid
  request.body = order_payload.to_json
  http = https_client_for(create_order_url_str)
  response = http.request(request)

  if response.code.to_i >= 400
    puts 'Error in authorize_and_capture_reference_transaction:'
    puts "- Status: #{response.code}"
    begin
      error_data = JSON.parse(response.body)
      puts "- Data: #{JSON.pretty_generate(error_data)}"
      puts "- Debug ID: #{error_data['debug_id']}"
    rescue JSON::ParserError
      puts "- Data: #{response.body}"
    end
    raise "Request failed with status #{response.code}"
  end

  response_data = JSON.parse(response.body)
  puts "Order details: #{JSON.pretty_generate(response_data)}"
  authorization_id = response_data['purchase_units'][0]['payments']['authorizations'][0]['id']
  puts "Authorization ID: #{authorization_id}"

  puts 'Capturing authorized payment...'
  capture_details = capture_authorization(authorization_id)
  puts "Capture Details: #{JSON.pretty_generate(capture_details)}"
  capture_details
rescue StandardError => e
  puts "Error in authorize_and_capture_reference_transaction: #{e.message}"
  raise e
end
```