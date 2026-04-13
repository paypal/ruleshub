#### Get Order Details

```py
def get_order_details(order_id):
    try:
        access_token = get_paypal_access_token()
        headers = {
            'Authorization': f'Bearer {access_token}',
        }
        response = requests.get(
            f'{baseUrl}/v2/checkout/orders/{order_id}',
            headers=headers
        )
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