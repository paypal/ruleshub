# Create Setup Token (Server-Side)

## Flask Implementation

```python
app = Flask(__name__)

PAYPAL_CLIENT_ID = os.environ['PAYPAL_CLIENT_ID']
PAYPAL_CLIENT_SECRET = os.environ['PAYPAL_CLIENT_SECRET']
PAYPAL_BASE_URL = os.environ.get('PAYPAL_BASE_URL', 'https://api-m.sandbox.paypal.com')

def get_access_token():
    auth = base64.b64encode(f"{PAYPAL_CLIENT_ID}:{PAYPAL_CLIENT_SECRET}".encode()).decode()
    
    response = requests.post(
        f'{PAYPAL_BASE_URL}/v1/oauth2/token',
        headers={
            'Authorization': f'Basic {auth}',
            'Content-Type': 'application/x-www-form-urlencoded'
        },
        data='grant_type=client_credentials'
    )
    response.raise_for_status()
    return response.json()['access_token']

@app.route('/paypal-api/vault/setup-tokens', methods=['POST'])
def create_setup_token():
    try:
        data = request.get_json()
        access_token = get_access_token()
        
        payment_method = data.get('payment_method', 'paypal')
        
        setup_token_payload = {}
        
        if payment_method == 'paypal':
            setup_token_payload = {
                'payment_source': {
                    'paypal': {
                        'usage_type': data.get('usage_type', 'MERCHANT'),
                        'customer_type': data.get('customer_type', 'CONSUMER'),
                        'permit_multiple_payment_tokens': data.get('permit_multiple_payment_tokens', True)
                    }
                }
            }
        elif payment_method == 'card':
            setup_token_payload = {
                'payment_source': {
                    'card': {
                        'experience_context': {
                            'return_url': data.get('return_url', f"{request.host_url}returnUrl"),
                            'cancel_url': data.get('cancel_url', f"{request.host_url}cancelUrl")
                        },
                        'verification_method': data.get('verification_method', 'SCA_WHEN_REQUIRED')
                    }
                }
            }
        
        print('Creating setup token')
        
        response = requests.post(
            f'{PAYPAL_BASE_URL}/v3/vault/setup-tokens',
            headers={
                'Content-Type': 'application/json',
                'Authorization': f'Bearer {access_token}',
                'PayPal-Request-Id': str(uuid.uuid4())
            },
            json=setup_token_payload
        )
        
        if not response.ok:
            error_data = response.json()
            debug_id = response.headers.get('PayPal-Debug-Id')
            
            return jsonify({
                'error': 'SETUP_TOKEN_FAILED',
                'message': error_data.get('message', 'Failed to create setup token'),
                'debugId': debug_id,
                'details': error_data.get('details')
            }), response.status_code
        
        setup_data = response.json()
        
        print(f"Setup token created: {setup_data['id']}, status: {setup_data['status']}")
        
        return jsonify({
            'id': setup_data['id'],
            'status': setup_data['status']
        })
        
    except requests.exceptions.RequestException as e:
        error_data = e.response.json() if e.response else {}
        debug_id = e.response.headers.get('PayPal-Debug-Id') if e.response else None
        
        print(f'Error creating setup token: {error_data}')
        
        return jsonify({
            'error': 'SETUP_TOKEN_FAILED',
            'message': 'Failed to create setup token',
            'debugId': debug_id
        }), e.response.status_code if e.response else 500

@app.route('/paypal-api/vault/setup-tokens/<token_id>', methods=['GET'])
def get_setup_token(token_id):
    try:
        access_token = get_access_token()
        
        response = requests.get(
            f'{PAYPAL_BASE_URL}/v3/vault/setup-tokens/{token_id}',
            headers={
                'Authorization': f'Bearer {access_token}',
                'Content-Type': 'application/json'
            }
        )
        
        if not response.ok:
            return jsonify({'error': 'SETUP_TOKEN_NOT_FOUND'}), 404
        
        return jsonify(response.json())
        
    except Exception as e:
        return jsonify({'error': 'FETCH_FAILED'}), 500
```

