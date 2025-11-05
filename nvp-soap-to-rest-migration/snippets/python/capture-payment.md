#### Capturing full authorized amount

> Note: Use the capture authorization endpoint with an empty request body to capture the entire authorized amount and treat it as the final capture.

```py
def capture_authorization(authorization_id):
    try:
        access_token = get_paypal_access_token()
        headers = {
            'Authorization': f'Bearer {access_token}',
            'PayPal-Request-Id': str(uuid.uuid4()),
            'Content-Type': 'application/json',
        }
        response = requests.post(
            f'{baseUrl}/v2/payments/authorizations/{authorization_id}/capture',
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

#### Capturing part of the authorized amount

> Note: For partial captures, specify amount to be captured and set "final_capture" explicitly to false.

```py
def capture_authorization_partial(authorization_id, amount, final_capture=True):
    try:
        access_token = get_paypal_access_token()
        headers = {
            'Authorization': f'Bearer {access_token}',
            'PayPal-Request-Id': str(uuid.uuid4()),
            'Content-Type': 'application/json',
        }
        payload = {
            'amount': {
                'currency_code': 'USD', # Legacy equivalents — NVP: CURRENCYCODE; SOAP: Amount.currencyID
                'value': amount, # Legacy equivalents — NVP: AMT; SOAP: Amount
            },
            'final_capture': final_capture, # Legacy equivalents — NVP: COMPLETETYPE; SOAP: CompleteType
        }
        response = requests.post(
            f'{baseUrl}/v2/payments/authorizations/{authorization_id}/capture',
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