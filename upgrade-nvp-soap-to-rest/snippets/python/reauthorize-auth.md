#### Reauthorizing the full amount that was authorized before

> Note: Sending a reauthorization request with an empty body will reauthorize the full amount of the previously authorized order.

```py
def reauthorize_auth(authorization_id):
    """
        The authorizationId parameter must be the original identifier returned when the order was first authorized.
    """
    try:
        access_token = get_paypal_access_token()
        headers = {
            'Content-Type': 'application/json',
            'Authorization': f'Bearer {access_token}',
            'PayPal-Request-Id': str(uuid.uuid4()),
        }
        response = requests.post(
            f'{baseUrl}/v2/payments/authorizations/{authorization_id}/reauthorize',
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

#### Reauthorizing part of the amount that was authorized before

> Note: Include the amount field in the reauthorization request body to reauthorize a specific amount, which must not exceed the originally authorized value.

```py
def reauthorize_auth_partial(authorization_id, amount):
    try:
        access_token = get_paypal_access_token()
        headers = {
            'Content-Type': 'application/json',
            'Authorization': f'Bearer {access_token}',
            'PayPal-Request-Id': str(uuid.uuid4()),
        }
        payload = {
            'amount': {
                'currency_code': 'USD', # Legacy equivalents — NVP: CURRENCYCODE; SOAP: Not Supported
                'value': amount, # Legacy equivalents — NVP: AMT; SOAP: Amount
            },
        }
        response = requests.post(
            f'{baseUrl}/v2/payments/authorizations/{authorization_id}/reauthorize',
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