#### SNIPPET-MRPPS

**Manage Subscription Status (replaces ManageRecurringPaymentsProfileStatus)**

> REST has three separate endpoints based on action:
> - Suspend: `POST /v1/billing/subscriptions/{id}/suspend`
> - Cancel: `POST /v1/billing/subscriptions/{id}/cancel`
> - Reactivate: `POST /v1/billing/subscriptions/{id}/activate`

**Suspend Subscription**

```rb
# Suspend subscription (temporarily pause billing)
# Legacy equivalents — NVP: ManageRecurringPaymentsProfileStatus with ACTION=Suspend
#
# @param subscription_id [String] REST subscription ID (starts with I-). Legacy equivalents — NVP: PROFILEID; SOAP: ProfileID
# @param reason [String] Reason for suspension (required in REST). Legacy equivalents — NVP: NOTE; SOAP: Note
def suspend_subscription(subscription_id, reason)
  access_token = get_paypal_access_token

  url_str = "#{$paypal_base_url}/v1/billing/subscriptions/#{subscription_id}/suspend"
  url = URI(url_str)

  payload = { 'reason' => reason }

  request = Net::HTTP::Post.new(url)
  request['Content-Type'] = 'application/json'
  request['Authorization'] = "Bearer #{access_token}"
  request['PayPal-Request-Id'] = SecureRandom.uuid
  request.body = payload.to_json

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

  puts "Subscription suspended"
rescue StandardError => e
  puts "Error in suspend_subscription: #{e.message}"
  raise e
end
```

**Cancel Subscription**

```rb
# Cancel subscription (permanently end - cannot be undone)
# Legacy equivalents — NVP: ManageRecurringPaymentsProfileStatus with ACTION=Cancel
#
# @param subscription_id [String] REST subscription ID. Legacy equivalents — NVP: PROFILEID; SOAP: ProfileID
# @param reason [String] Reason for cancellation (required in REST). Legacy equivalents — NVP: NOTE; SOAP: Note
def cancel_subscription(subscription_id, reason)
  access_token = get_paypal_access_token

  url_str = "#{$paypal_base_url}/v1/billing/subscriptions/#{subscription_id}/cancel"
  url = URI(url_str)

  payload = { 'reason' => reason }

  request = Net::HTTP::Post.new(url)
  request['Content-Type'] = 'application/json'
  request['Authorization'] = "Bearer #{access_token}"
  request['PayPal-Request-Id'] = SecureRandom.uuid
  request.body = payload.to_json

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

  puts "Subscription cancelled"
rescue StandardError => e
  puts "Error in cancel_subscription: #{e.message}"
  raise e
end
```

**Reactivate Subscription**

```rb
# Reactivate subscription (resume from suspended state)
# Legacy equivalents — NVP: ManageRecurringPaymentsProfileStatus with ACTION=Reactivate
# Note: This is the same endpoint used for initial activation after buyer approval
#
# @param subscription_id [String] REST subscription ID. Legacy equivalents — NVP: PROFILEID; SOAP: ProfileID
# @param reason [String] Reason for reactivation. Legacy equivalents — NVP: NOTE; SOAP: Note
def reactivate_subscription(subscription_id, reason)
  access_token = get_paypal_access_token

  url_str = "#{$paypal_base_url}/v1/billing/subscriptions/#{subscription_id}/activate"
  url = URI(url_str)

  payload = { 'reason' => reason }

  request = Net::HTTP::Post.new(url)
  request['Content-Type'] = 'application/json'
  request['Authorization'] = "Bearer #{access_token}"
  request['PayPal-Request-Id'] = SecureRandom.uuid
  request.body = payload.to_json

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

  puts "Subscription reactivated"
rescue StandardError => e
  puts "Error in reactivate_subscription: #{e.message}"
  raise e
end
```
