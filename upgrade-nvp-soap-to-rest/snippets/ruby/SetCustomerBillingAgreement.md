#### SNIPPET-SetCustomerBA

**Create a setup token for billing agreement (Flow B Migration)**

>  **Legacy Context:** This replaces the deprecated `SetCustomerBillingAgreement` API (deprecated since version 54.0). The legacy API returned tokens with "RP-" prefix. The modern API returns setup token IDs.

```ruby
def create_setup_token_for_billing_agreement
  access_token = get_access_token
  url = "#{BASE_URL}/v3/vault/setup-tokens"
  
  payload = {
    payment_source: {
      paypal: {
        description: 'Monthly subscription for premium service', # Legacy equivalents — NVP: L_BILLINGAGREEMENTDESCRIPTIONn; SOAP: BillingAgreementDetails.BillingAgreementDescription
        experience_context: {
          return_url: 'https://example.com/return', # Legacy equivalents — NVP: RETURNURL; SOAP: ReturnURL
          cancel_url: 'https://example.com/cancel', # Legacy equivalents — NVP: CANCELURL; SOAP: CancelURL
          locale: 'en-US' # Legacy equivalents — NVP: LOCALECODE; SOAP: LocaleCode
        },
        usage_pattern: 'IMMEDIATE', # Only available in REST APIs
        usage_type: 'MERCHANT' # Only available in REST APIs
      }
    }
  }
  
  headers = {
    'Content-Type' => 'application/json',
    'Authorization' => "Bearer #{access_token}",
    'PayPal-Request-Id' => SecureRandom.uuid
  }
  
  response = HTTParty.post(url, body: payload.to_json, headers: headers)
  
  if response.code >= 400
    error_debug_id = response.parsed_response['debug_id'] rescue 'N/A'
    puts "Error debug id: #{error_debug_id}"
    raise "Request failed with status code #{response.code}: #{response.body}"
  end
  
  setup_token_id = response['id']
  approval_url = response['links']&.find { |link| link['rel'] == 'approve' }&.dig('href')
  
  puts "Setup Token Created: #{setup_token_id}"
  puts "Redirect customer to: #{approval_url}"
  
  {
    setup_token_id: setup_token_id,
    approval_url: approval_url
  }
rescue StandardError => e
  puts "Error: #{e.message}"
  raise
end
```

**Migration Notes:**

- **Legacy Fields NOT Supported:**
  - `BILLINGTYPE` / `BillingAgreementDetails.BillingType` - Handled by vault endpoint structure
  - `PAGESTYLE`, `HDRIMG`, `HDRBACKCOLOR`, etc. - UI customization not available in v3
  - `L_BILLINGAGREEMENTCUSTOMn` - Custom metadata not supported
  - `EMAIL` / `BuyerEmail` - Not required in vault setup

- **Authentication:** Replace `USER`, `PWD`, `SIGNATURE` with OAuth 2.0 access token

- **Token Format:** Legacy returned "RP-{token}" format. REST returns a setup token ID.

- **Webhook Required:** Set up webhook for `VAULT.PAYMENT-TOKEN.CREATED` event to capture the payment token ID after customer approval.

