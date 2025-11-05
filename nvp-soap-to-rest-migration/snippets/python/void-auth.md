#### Void an Authorization

> Note: A status code of 204 is returned when the **Prefer** header is set to *return=minimal* (default behavior).
> A status code of 200 is returned when the **Prefer** header is set to *return=representation*. 

```py
def void_auth(auth_id):
    try:
        access_token = get_paypal_access_token()
        headers = {
            'Content-Type': 'application/json',
            'Authorization': f'Bearer {access_token}',
            'PayPal-Request-Id': str(uuid.uuid4()),
        }
        response = requests.post(
            f'{baseUrl}/v2/payments/authorizations/{auth_id}/void',
            headers=headers,
            json={}
        )
        # A successful void request returns a 204 No Content response
        if response.status_code == 204 or response.status_code == 200:
            return True
        else:
            response.raise_for_status() # Will raise an exception for non-2xx responses
            return False # Should not be reached if raise_for_status() is effective
    except requests.exceptions.RequestException as err:
        if err.response:
            try:
                # Attempt to get debug_id, but handle cases where response body might be empty or not JSON
                debug_id = err.response.json().get('debug_id') if err.response.content else None
                print(f"Error debug id: {debug_id}")
            except Exception:
                print(f"Error getting debug id from response: {err.response.text}")
        else:
            print("Request failed without a response.")
        raise err 
```