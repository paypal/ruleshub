# Client Token Generation (Server-Side)

## Flask Implementation

```python
app = Flask(__name__)

PAYPAL_CLIENT_ID = os.environ['PAYPAL_CLIENT_ID']
PAYPAL_CLIENT_SECRET = os.environ['PAYPAL_CLIENT_SECRET']
PAYPAL_ENVIRONMENT = os.environ.get('PAYPAL_ENVIRONMENT', 'sandbox')
PAYPAL_BASE_URL = 'https://api-m.paypal.com' if PAYPAL_ENVIRONMENT == 'live' else 'https://api-m.sandbox.paypal.com'

cached_token = None
token_expiration = None

@app.route('/paypal-api/auth/browser-safe-client-token', methods=['GET'])
def get_client_token():
    global cached_token, token_expiration
    
    try:
        if cached_token and token_expiration and datetime.now() < token_expiration:
            print('Returning cached client token')
            return jsonify({
                'accessToken': cached_token,
                'expiresIn': int((token_expiration - datetime.now()).total_seconds())
            })
        
        print('Generating new client token from PayPal')
        
        auth = base64.b64encode(f"{PAYPAL_CLIENT_ID}:{PAYPAL_CLIENT_SECRET}".encode()).decode()
        
        headers = {
            'Authorization': f'Basic {auth}',
            'Content-Type': 'application/x-www-form-urlencoded'
        }
        
        data = 'grant_type=client_credentials&response_type=client_token&intent=sdk_init'
        
        response = requests.post(
            f'{PAYPAL_BASE_URL}/v1/oauth2/token',
            headers=headers,
            data=data
        )
        response.raise_for_status()
        
        token_data = response.json()
        access_token = token_data['access_token']
        expires_in = token_data.get('expires_in', 900)
        
        cached_token = access_token
        token_expiration = datetime.now() + timedelta(seconds=expires_in - 120)
        
        print('Client token generated successfully')
        return jsonify({
            'accessToken': access_token,
            'expiresIn': expires_in
        })
        
    except requests.exceptions.RequestException as e:
        error_data = e.response.json() if e.response else {}
        debug_id = e.response.headers.get('PayPal-Debug-Id') if e.response else None
        
        print(f'Error generating client token: {error_data}')
        
        return jsonify({
            'error': 'TOKEN_GENERATION_FAILED',
            'message': 'Failed to generate client token',
            'debugId': debug_id
        }), e.response.status_code if e.response else 500

def get_access_token():
    auth = base64.b64encode(f"{PAYPAL_CLIENT_ID}:{PAYPAL_CLIENT_SECRET}".encode()).decode()
    
    headers = {
        'Authorization': f'Basic {auth}',
        'Content-Type': 'application/x-www-form-urlencoded'
    }
    
    response = requests.post(
        f'{PAYPAL_BASE_URL}/v1/oauth2/token',
        headers=headers,
        data='grant_type=client_credentials'
    )
    response.raise_for_status()
    
    return response.json()['access_token']
```

## Environment Variables

```bash
PAYPAL_CLIENT_ID=your_paypal_client_id_here
PAYPAL_CLIENT_SECRET=your_paypal_client_secret_here
PAYPAL_ENVIRONMENT=sandbox
PORT=3000
```

