#### OAuth2.0 Authentication

```py
def get_paypal_access_token():
    try:
        cached_token = token_cache.get('access_token')
        if cached_token and cached_token['expires'] > time.time():
            return cached_token['token']
        client_id = os.environ.get('PAYPAL_CLIENT_ID')
        client_secret = os.environ.get('PAYPAL_CLIENT_SECRET')
        if not client_id or not client_secret:
            raise ValueError("PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET environment variables must be set.")
        auth = base64.b64encode(f"{client_id}:{client_secret}".encode()).decode()
        headers = {
            'Authorization': f'Basic {auth}',
            'Content-Type': 'application/x-www-form-urlencoded',
            'PayPal-Request-Id': str(uuid.uuid4()),
        }
        data = 'grant_type=client_credentials'
        response = requests.post(
            f'{baseUrl}/v1/oauth2/token',
            headers=headers,
            data=data
        )
        response.raise_for_status()  # Raises an exception for bad responses (4xx or 5xx)
        token_data = response.json()
        token_cache['access_token'] = {
            'token': token_data['access_token'],
            'expires': time.time() + token_data['expires_in'] - 60  # 1 minute buffer
        }
        return token_data['access_token']
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