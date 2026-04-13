#### SNIPPET-URPP

**Update Subscription (replaces UpdateRecurringPaymentsProfile)**

> REST equivalent: `PATCH /v1/billing/subscriptions/{subscription_id}`

```rb
# Update subscription
# Legacy equivalents — NVP: UpdateRecurringPaymentsProfile; SOAP: UpdateRecurringPaymentsProfile
#
# @param subscription_id [String] REST subscription ID (starts with I-). Legacy equivalents — NVP: PROFILEID; SOAP: ProfileID
# @param patch_operations [Array] JSON Patch operations array
# @return [Hash] Updated subscription
def update_subscription(subscription_id, patch_operations)
  access_token = get_paypal_access_token

  url_str = "#{$paypal_base_url}/v1/billing/subscriptions/#{subscription_id}"
  url = URI(url_str)

  request = Net::HTTP::Patch.new(url)
  request['Content-Type'] = 'application/json'
  request['Authorization'] = "Bearer #{access_token}"
  request['PayPal-Request-Id'] = SecureRandom.uuid
  request.body = patch_operations.to_json

  http = https_client_for(url_str)
  response = http.request(request)

  if response.code.to_i >= 400
    begin
      error_data = JSON.parse(response.body)
      puts "Error debug id: #{error_data['debug_id']}"
    rescue JSON::ParserError
      puts "Error debug id: N/A"
    end
    raise "Request failed with status #{response.code}"
  end

  JSON.parse(response.body)
rescue StandardError => e
  puts "Error in update_subscription: #{e.message}"
  raise e
end
```

**Update billing amount (20% limit applies)**

```rb
# Update subscription billing amount
# Legacy equivalents — NVP: AMT; SOAP: PaymentPeriod.Amount
#
# Note: Can only increase by 20% maximum per 180-day interval
# Note: Cannot update within 3 days of scheduled billing date
def update_billing_amount(subscription_id, amount, currency_code = 'USD')
  patch_operations = [
    {
      'op' => 'replace',
      'path' => '/plan/billing_cycles/@sequence==1/pricing_scheme/fixed_price',
      'value' => {
        'currency_code' => currency_code, # Legacy equivalents — NVP: CURRENCYCODE; SOAP: Amount.currencyID
        'value' => amount                 # Legacy equivalents — NVP: AMT; SOAP: PaymentPeriod.Amount
      }
    }
  ]
  
  update_subscription(subscription_id, patch_operations)
end
```

**Update shipping amount**

```rb
# Update subscription shipping amount
# Legacy equivalents — NVP: SHIPPINGAMT; SOAP: PaymentPeriod.ShippingAmount
def update_shipping_amount(subscription_id, amount, currency_code = 'USD')
  patch_operations = [
    {
      'op' => 'replace',
      'path' => '/shipping_amount',
      'value' => {
        'currency_code' => currency_code,
        'value' => amount  # Legacy equivalents — NVP: SHIPPINGAMT; SOAP: PaymentPeriod.ShippingAmount
      }
    }
  ]
  
  update_subscription(subscription_id, patch_operations)
end
```
