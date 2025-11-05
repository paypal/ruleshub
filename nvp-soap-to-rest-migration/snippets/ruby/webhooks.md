#### Setting up webhook for persisting vaulted payment source id

> To learn more, refer to [Create Webhook](https://developer.paypal.com/docs/api/webhooks/v1/#webhooks_post) and [List webhooks](https://developer.paypal.com/docs/api/webhooks/v1/#webhooks_list).

```rb
def create_webhook(webhook_url)
  access_token = get_paypal_access_token

  # List existing webhooks
  list_url_str = "#{$paypal_base_url}/v1/notifications/webhooks"
  list_url = URI(list_url_str)
  request = Net::HTTP::Get.new(list_url)
  request['Content-Type'] = 'application/json'
  request['Authorization'] = "Bearer #{access_token}"
  http = https_client_for(list_url_str)
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

  list_data = JSON.parse(response.body)
  list_data['webhooks']&.each do |webhook|
    if webhook['url'] == webhook_url
      puts "Found existing webhook: #{webhook}"
      return webhook
    end
  end

  # Create a new webhook if it doesn't exist
  create_url_str = "#{$paypal_base_url}/v1/notifications/webhooks"
  create_url = URI(create_url_str)
  payload = {
    'url' => webhook_url,
    'event_types' => [{ 'name' => 'VAULT.PAYMENT-TOKEN.CREATED' }]
  }

  request = Net::HTTP::Post.new(create_url)
  request['Content-Type'] = 'application/json'
  request['Authorization'] = "Bearer #{access_token}"
  request['PayPal-Request-Id'] = SecureRandom.uuid
  request.body = payload.to_json
  http = https_client_for(create_url_str)
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
  puts "Error in create_webhook: #{e.message}"
  raise e
end
```

#### Webhook signature verification

> To learn more, refer to [Verify Webhook Signatures](https://developer.paypal.com/docs/api/webhooks/v1/#verify-webhook-signature_post).

```rb
def verify_webhook_signature(webhook_id, headers, body)
  token = get_paypal_access_token
  verification_data = {
    'auth_algo' => headers['paypal-auth-algo'],
    'cert_url' => headers['paypal-cert-url'],
    'transmission_id' => headers['paypal-transmission-id'],
    'transmission_sig' => headers['paypal-transmission-sig'],
    'transmission_time' => headers['paypal-transmission-time'],
    'webhook_id' => webhook_id,
    'webhook_event' => body
  }

  url = "#{$paypal_base_url}/v1/notifications/verify-webhook-signature"
  uri = URI(url)
  request = Net::HTTP::Post.new(uri)
  request['Content-Type'] = 'application/json'
  request['Authorization'] = "Bearer #{token}"
  request.body = verification_data.to_json
  http = https_client_for(url)
  response = http.request(request)

  if response.code.to_i >= 400
    raise "Webhook verification request failed with status #{response.code}"
  end

  result = JSON.parse(response.body)
  result['verification_status'] == 'SUCCESS'
end
```

#### Webhook handler to capture and store "VaultId" from the event data

> To learn more, refer to [Show event notification details](https://developer.paypal.com/docs/api/webhooks/v1/#webhooks-events_get).

```rb
def webhook_handler(webhook_id, headers, body)
  is_verified = verify_webhook_signature(webhook_id, headers, body)
  raise 'Webhook verification failed' unless is_verified

  event = body
  if event['event_type'] == 'VAULT.PAYMENT-TOKEN.CREATED'
    # This is the unique identifier associated with the customer's payment source stored in the PayPal Vault.
    # This "vaultId" can be used to make future payments without needing customer's consent.
    vault_id = event.dig('resource', 'id')
    # TODO: Save the vaultId to the database.
    return vault_id
  end

  raise 'Invalid webhook event'
end
```