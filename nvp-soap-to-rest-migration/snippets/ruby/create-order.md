#### Create an order

```rb
def create_order()
  # Creates an order.
  access_token = get_paypal_access_token

  payload = {
    'intent' => 'CAPTURE', # Legacy equivalents — NVP: PAYMENTREQUEST_n_PAYMENTACTION or PAYMENTACTION ; SOAP: PaymentDetails.PaymentAction
    'purchase_units' => [
      {
        'amount' => {
          'currency_code' => 'USD', # Legacy equivalents — NVP: CURRENCYCODE ; SOAP: PaymentDetails.OrderTotal.currencyID
          'value' => '10.00' # Legacy equivalents — NVP: AMT ; SOAP: PaymentDetails.OrderTotal
        }
      }
    ],
    'payment_source' => {
      'paypal' => {
        'experience_context' => {
          'return_url' => 'https://example.com/return', # Legacy equivalents — NVP: RETURNURL ; SOAP: ReturnURL
          'cancel_url' => 'https://example.com/cancel' # Legacy equivalents — NVP: CANCELURL ; SOAP: CancelURL
        }
      }
    }
  }

  url = "#{$paypal_base_url}/v2/checkout/orders"
  uri = URI(url)
  request = Net::HTTP::Post.new(uri)
  request['Content-Type'] = 'application/json'
  request['Authorization'] = "Bearer #{access_token}"
  request['PayPal-Request-Id'] = SecureRandom.uuid
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
  order_id = response_data['id']

  approval_url = nil
  response_data['links']&.each do |link|
    if ['approve', 'payer-action'].include?(link['rel'])
      approval_url = link['href']
      break
    end
  end

  { 'order_id' => order_id, 'approval_url' => approval_url }
rescue StandardError => e
  puts "Error in create_order: #{e.message}"
  raise e
end
```