#### Refund the pending captured amount

> Note: Send an empty request body to initiate a refund for the amount equal to [captured amount – refunds already issued].

```py
def refund_transaction(transaction_id):
    try:
        access_token = get_paypal_access_token()
        headers = {
            'Content-Type': 'application/json',
            'Authorization': f'Bearer {access_token}',
            'PayPal-Request-Id': str(uuid.uuid4()),
        }
        response = requests.post(
            f'{baseUrl}/v2/payments/captures/{transaction_id}/refund',
            headers=headers,
            json={}
        )
        response.raise_for_status()
        return response.json()['id']
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

#### Refund specific amount

> Note: Include the specific amount in the request body to initiate a refund for that amount against the capture.

```py
def refund_transaction_partial(transaction_id, amount):
    try:
        access_token = get_paypal_access_token()
        headers = {
            'Content-Type': 'application/json',
            'Authorization': f'Bearer {access_token}',
            'PayPal-Request-Id': str(uuid.uuid4())
        }
        payload = {
            'amount': {
                'currency_code': 'USD', # Legacy equivalents — NVP: CURRENCYCODE ; SOAP: Amount.currencyID
                'value': amount # Legacy equivalents — NVP: AMT ; SOAP: Amount
            }
        }
        response = requests.post(
            f'{baseUrl}/v2/payments/captures/{transaction_id}/refund',
            headers=headers,
            json=payload
        )
        response.raise_for_status()
        return response.json()['id']
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