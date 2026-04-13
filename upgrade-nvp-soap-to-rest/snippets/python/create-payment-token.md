#### Exchanging temporary setup token for a payment token

```py
def create_payment_token(setup_token_id):
    """
        `setup_token_id` is the setup token created with the `POST /v3/vault/setup-tokens` call.
    """
    try:
        access_token = get_paypal_access_token()
        url = f"{baseUrl}/v3/vault/payment-tokens"
        payload = {
            "payment_source": {
                "token": {
                    "id": setup_token_id,
                    "type": "SETUP_TOKEN"
                }
            }
        }
        headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {access_token}",
            "PayPal-Request-Id": str(uuid.uuid4())
        }
        response = requests.post(url, json=payload, headers=headers)
        response.raise_for_status()
        return response.json()
    except requests.exceptions.RequestException as err:
        print(f"Error debug id: {err.response.json().get('debug_id') if err.response else 'N/A'}")
        raise 
```