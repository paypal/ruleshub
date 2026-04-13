#### SNIPPET-GetBACustomerDetails

**Retrieve setup token details (Flow B Migration)**

>  **Legacy Context:** This replaces the deprecated `GetBillingAgreementCustomerDetails` API. **Critical:** The legacy API returned extensive customer information. The modern API returns token status but NOT detailed customer info.

```ruby
def get_setup_token_details(setup_token_id)
  access_token = get_access_token
  url = "#{BASE_URL}/v3/vault/setup-tokens/#{setup_token_id}"
  
  headers = {
    'Content-Type' => 'application/json',
    'Authorization' => "Bearer #{access_token}"
  }
  
  response = HTTParty.get(url, headers: headers)
  
  if response.code >= 400
    error_debug_id = response.parsed_response['debug_id'] rescue 'N/A'
    puts "Error debug id: #{error_debug_id}"
    raise "Request failed with status code #{response.code}: #{response.body}"
  end
  
  puts "Setup Token Status: #{response['status']}"
  
  response.parsed_response
rescue StandardError => e
  puts "Error: #{e.message}"
  raise
end
```

** Critical Migration Warning: Customer Data NOT Available**

The legacy `GetBillingAgreementCustomerDetails` API returned:
-  Customer email, name, address (NVP: ALL fields unsupported)
-  Customer email, name, address (SOAP: SOME fields available in payment token response)
-  Payer ID, payer status
-  Shipping information

**The modern REST API response includes:**
-  Setup token status and ID
-  Payment source type
-  Links for approval and other actions
-  NO customer personal information in this call

**Migration Strategy:**

1. **For NVP Users:** You MUST store customer information in your own database before redirecting to PayPal. The REST API will not return this data.

2. **For SOAP Users:** Some customer data is available after creating the payment token:
```ruby
def get_payment_token_details(payment_token_id)
  access_token = get_access_token
  url = "#{BASE_URL}/v3/vault/payment-tokens/#{payment_token_id}"
  
  headers = {
    'Content-Type' => 'application/json',
    'Authorization' => "Bearer #{access_token}"
  }
  
  response = HTTParty.get(url, headers: headers)
  response.parsed_response
  
  # Extract available customer fields
  paypal = response.dig('payment_source', 'paypal') || {}
  
  {
    email: paypal['email_address'],
    account_id: paypal['account_id'],
    name: paypal.dig('name', 'full_name'),
    address: paypal['address']
  }
rescue StandardError => e
  puts "Error: #{e.message}"
  raise
end
```

3. **Alternative:** Use PayPal Identity APIs after customer authorization to get detailed customer information.

**Fields NOT Available in v3 (Plan Accordingly):**

**NVP Response - ALL UNSUPPORTED:**
- `EMAIL`, `FIRSTNAME`, `LASTNAME`, `PAYERID`, `PAYERSTATUS`
- `COUNTRYCODE`, `ADDRESSSTATUS`, `PAYERBUSINESS`
- `SHIPTONAME`, `SHIPTOSTREET`, `SHIPTOCITY`, `SHIPTOSTATE`, `SHIPTOZIP`

**SOAP Response - PARTIALLY SUPPORTED:**
- `PayerInfo.Payer` maps to `payment_source.paypal.email_address`
- `PayerInfo.PayerID` maps to `payment_source.paypal.account_id`
- `PayerInfo.Address.*` maps to `payment_source.paypal.address.*`
- `PayerInfo.PayerStatus`, `PayerInfo.PayerBusiness` - Not supported
- Separate first/last/middle names - Only full_name available

