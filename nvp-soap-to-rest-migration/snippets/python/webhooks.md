#### Setting up webhook for persisting vaulted payment source id

> To learn more, refer to [Create Webhook](https://developer.paypal.com/docs/api/webhooks/v1/#webhooks_post) and [List webhooks](https://developer.paypal.com/docs/api/webhooks/v1/#webhooks_list).

```py
def create_webhook(webhook_url):
    try:
        access_token = get_paypal_access_token()
        headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {access_token}",
        }
        list_url = f"{baseUrl}/v1/notifications/webhooks"
        response = requests.get(list_url, headers=headers)
        response.raise_for_status()
        list_data = response.json()
        for webhook in list_data.get("webhooks", []):
            if webhook.get("url") == webhook_url:
                print(f"Found existing webhook: {webhook}")
                return webhook
        # Create a new webhook if it doesn't exist
        create_url = f"{baseUrl}/v1/notifications/webhooks"
        payload = {
            "url": webhook_url,
            "event_types": [{"name": "VAULT.PAYMENT-TOKEN.CREATED"}],
        }
        headers["PayPal-Request-Id"] = str(uuid.uuid4())
        response = requests.post(create_url, headers=headers, json=payload)
        response.raise_for_status()
        return response.json()
    except requests.exceptions.RequestException as err:
        if err.response:
            try:
                print(f"Error debug id: {err.response.json().get('debug_id')}")
            except Exception:
                print(f"Error getting debug id from response: {err.response.text}")
        else:
            print("Request failed without a response.")
        raise err 
```

#### Webhook signature verification

> To learn more, refer to [Verify Webhook Signatures](https://developer.paypal.com/docs/api/webhooks/v1/#verify-webhook-signature_post).

```py
def verify_webhook_signature(self, webhook_id, headers, body):
    token = get_paypal_access_token()
    verification_data = {
        'auth_algo': headers.get('paypal-auth-algo'),
        'cert_url': headers.get('paypal-cert-url'),
        'transmission_id': headers.get('paypal-transmission-id'),
        'transmission_sig': headers.get('paypal-transmission-sig'),
        'transmission_time': headers.get('paypal-transmission-time'),
        'webhook_id': webhook_id,
        'webhook_event': json.loads(body)
    }
    response = requests.post(
        f'{baseUrl}/v1/notifications/verify-webhook-signature',
        json=verification_data,
        headers={
            'Content-Type': 'application/json',
            'Authorization': f'Bearer {token}'
        }
    )
    result = response.json()
    return result.get('verification_status') == 'SUCCESS'
```

#### Webhook handler to capture and store "VaultId" from the event data

> To learn more, refer to [Show event notification details](https://developer.paypal.com/docs/api/webhooks/v1/#webhooks-events_get).

```py
def webhook_handler(webhook_id, headers, body):
    is_verified = verify_webhook_signature(webhook_id, headers, body)
    if not is_verified:
        raise Exception('Webhook verification failed')
    event = body
    if event.get('event_type') == 'VAULT.PAYMENT-TOKEN.CREATED':
        # This is the unique identifier associated with the customer's payment source stored in the PayPal Vault.
        # This "vaultId" can be used to make future payments without needing customer's consent.
        vault_id = event.get('resource', {}).get('id')
        # TODO: Save the vaultId to the database.
        return vault_id
    raise Exception('Invalid webhook event')
```