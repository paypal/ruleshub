#### Creating a "CAPTURE" order with vaulted payment

```py
def capture_reference_transaction(vault_id, amount, currency_code):
    try:
        print('Creating order for reference transaction...')
        access_token = get_paypal_access_token()
        create_order_url = f'{baseUrl}/v2/checkout/orders'
        order_payload = {
            'intent': 'CAPTURE', # Legacy equivalents — NVP: PAYMENTACTION ; SOAP: PaymentAction
            'purchase_units': [
                {
                    'amount': {
                        'currency_code': currency_code, # Legacy equivalents — NVP: CURRENCYCODE ; SOAP: PaymentDetails.OrderTotal.currencyID
                        'value': amount, # Legacy equivalents — NVP: AMT ; SOAP: PaymentDetails.OrderTotal
                    },
                },
            ],
            'payment_source': {
                'paypal': {
                    'vault_id': vault_id, # Used in place of legacy payload's BILLINGAGREEMENTID.
                },
            },
        }
        headers = {
            'Content-Type': 'application/json',
            'Authorization': f'Bearer {access_token}',
            'PayPal-Request-Id': str(uuid.uuid4()),
        }
        response = requests.post(create_order_url, headers=headers, json=order_payload)
        response.raise_for_status()
        response_data = response.json()
        order_id = response_data['id']
        return response_data
    except requests.exceptions.RequestException as err:
        debug_id = err.response.json().get('debug_id') if err.response.content else None
        print(f"Error debug id: {debug_id}")
        raise err
```

#### Creating a "AUTHORIZE" order with vaulted payment

```py
def authorize_and_capture_reference_transaction(vault_id, amount, currency_code):
    try:
        print('Creating order to authorize reference transaction...')
        access_token = get_paypal_access_token()
        create_order_url = f'{baseUrl}/v2/checkout/orders'
        order_payload = {
            'intent': 'AUTHORIZE', # Legacy equivalents — NVP: PAYMENTACTION ; SOAP: PaymentAction
            'purchase_units': [
                {
                    'amount': {
                        'currency_code': currency_code, # Legacy equivalents — NVP: CURRENCYCODE ; SOAP: PaymentDetails.OrderTotal.currencyID
                        'value': amount, # Legacy equivalents — NVP: AMT ; SOAP: PaymentDetails.OrderTotal
                    },
                },
            ],
            'payment_source': {
                'paypal': {
                    'vault_id': vault_id, # Used in place of legacy payload's BILLINGAGREEMENTID.
                },
            },
        }
        headers = {
            'Content-Type': 'application/json',
            'Authorization': f'Bearer {access_token}',
            'PayPal-Request-Id': str(uuid.uuid4()),
        }
        response = requests.post(create_order_url, headers=headers, json=order_payload)
        response.raise_for_status()
        response_data = response.json()
        authorization_id = response_data['purchase_units'][0]['payments']['authorizations'][0]['id']
        capture_details = capture_authorization(authorization_id)
        return capture_details
    except requests.exceptions.RequestException as err:
        debug_id = err.response.json().get('debug_id') if err.response.content else None
        print(f"Error debug id: {debug_id}")
        raise err 
```