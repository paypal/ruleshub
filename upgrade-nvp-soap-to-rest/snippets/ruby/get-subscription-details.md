#### SNIPPET-GRPPD

**Get Subscription Details (replaces GetRecurringPaymentsProfileDetails)**

> REST equivalent: `GET /v1/billing/subscriptions/{subscription_id}`

```rb
require 'net/http'
require 'json'
require 'securerandom'

# Get subscription details
# Legacy equivalents — NVP: GetRecurringPaymentsProfileDetails; SOAP: GetRecurringPaymentsProfileDetails
#
# @param subscription_id [String] REST subscription ID (starts with I-). Legacy equivalents — NVP: PROFILEID; SOAP: ProfileID
# @return [Hash] Subscription details including status, billing_info, subscriber
def get_subscription_details(subscription_id)
  access_token = get_paypal_access_token

  url_str = "#{$paypal_base_url}/v1/billing/subscriptions/#{subscription_id}"
  url = URI(url_str)

  request = Net::HTTP::Get.new(url)
  request['Content-Type'] = 'application/json'
  request['Authorization'] = "Bearer #{access_token}"
  request['PayPal-Request-Id'] = SecureRandom.uuid

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
  puts "Error in get_subscription_details: #{e.message}"
  raise e
end
```

**Get Plan Details (optional - if full billing cycle config needed)**

> Call this if subscription response doesn't include full billing cycle configuration

```rb
# Get plan details
#
# @param plan_id [String] Plan ID from subscription.plan_id
def get_plan_details(plan_id)
  access_token = get_paypal_access_token

  url_str = "#{$paypal_base_url}/v1/billing/plans/#{plan_id}"
  url = URI(url_str)

  request = Net::HTTP::Get.new(url)
  request['Content-Type'] = 'application/json'
  request['Authorization'] = "Bearer #{access_token}"
  request['PayPal-Request-Id'] = SecureRandom.uuid

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
  puts "Error in get_plan_details: #{e.message}"
  raise e
end
```
