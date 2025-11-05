#### Capturing payment for an Order

> Note: Always have an empty payload as request body while capturing payment for an order.

```py
def capture_order(order_id):
    try:
        access_token = get_paypal_access_token()
        headers = {
            'Authorization': f'Bearer {access_token}',
            'PayPal-Request-Id': str(uuid.uuid4()),
            'Content-Type': 'application/json',
        }
        response = requests.post(
            f'{baseUrl}/v2/checkout/orders/{order_id}/capture',
            headers=headers,
            json={}
        )
        response.raise_for_status()
        response_data = response.json()
        print(f"Capture details for Order ID: {order_id}")
        print(response_data)
        return response_data['purchase_units'][0]['payments']['captures'][0]['id']
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

#### Authorizing an Order

```py
def authorize_order(order_id):
    try:
        access_token = get_paypal_access_token()
        headers = {
            'Content-Type': 'application/json',
            'Authorization': f'Bearer {access_token}',
            'PayPal-Request-Id': str(uuid.uuid4()),
        }
        response = requests.post(
            f'{baseUrl}/v2/checkout/orders/{order_id}/authorize',
            headers=headers,
            json={}
        )
        response.raise_for_status()
        return response.json()['purchase_units'][0]['payments']['authorizations'][0]['id']
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