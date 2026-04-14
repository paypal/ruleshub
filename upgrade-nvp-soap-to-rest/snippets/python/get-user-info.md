#### Show user profile details

```py
def get_user_info():
    try:
        access_token = get_paypal_access_token()
        headers = {
            'Authorization': f'Bearer {access_token}',
            'Content-Type': 'application/x-www-form-urlencoded',
        }
        params = {
            'schema': 'openid',
        }
        response = requests.get(
            f'{baseUrl}/v1/identity/openidconnect/userinfo',
            headers=headers,
            params=params
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