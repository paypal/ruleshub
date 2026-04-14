# Create Payment Token (Server-Side)

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

@app.route('/paypal-api/vault/payment-tokens', methods=['POST'])
def create_payment_token():
    try:
        data = request.get_json()
        access_token = get_access_token()
        
        setup_token = data.get('vaultSetupToken')
        
        if not setup_token:
            return jsonify({
                'error': 'MISSING_SETUP_TOKEN',
                'message': 'vaultSetupToken is required'
            }), 400
        
        payment_token_payload = {
            'payment_source': {
                'token': {
                    'id': setup_token,
                    'type': 'SETUP_TOKEN'
                }
            }
        }
        
        print('Creating payment token from setup token')
        
        response = requests.post(
            f'{PAYPAL_BASE_URL}/v3/vault/payment-tokens',
            headers={
                'Content-Type': 'application/json',
                'Authorization': f'Bearer {access_token}',
                'PayPal-Request-Id': str(uuid.uuid4())
            },
            json=payment_token_payload
        )
        
        if not response.ok:
            error_data = response.json()
            debug_id = response.headers.get('PayPal-Debug-Id')
            
            return jsonify({
                'error': 'PAYMENT_TOKEN_FAILED',
                'message': error_data.get('message', 'Failed to create payment token'),
                'debugId': debug_id,
                'details': error_data.get('details')
            }), response.status_code
        
        token_data = response.json()
        
        print(f"Payment token created: {token_data['id']}")
        
        return jsonify({
            'id': token_data['id'],
            'customerId': token_data.get('customer', {}).get('id'),
            'status': 'saved'
        })
        
    except requests.exceptions.RequestException as e:
        error_data = e.response.json() if e.response else {}
        debug_id = e.response.headers.get('PayPal-Debug-Id') if e.response else None
        
        print(f'Error creating payment token: {error_data}')
        
        return jsonify({
            'error': 'PAYMENT_TOKEN_FAILED',
            'message': 'Failed to create payment token',
            'debugId': debug_id
        }), e.response.status_code if e.response else 500

@app.route('/paypal-api/vault/payment-tokens', methods=['GET'])
def list_payment_tokens():
    try:
        customer_id = request.args.get('customer_id')
        
        if not customer_id:
            return jsonify({
                'error': 'MISSING_CUSTOMER_ID',
                'message': 'customer_id query parameter is required'
            }), 400
        
        access_token = get_access_token()
        
        response = requests.get(
            f'{PAYPAL_BASE_URL}/v3/vault/payment-tokens',
            headers={
                'Authorization': f'Bearer {access_token}',
                'Content-Type': 'application/json'
            },
            params={'customer_id': customer_id}
        )
        
        if not response.ok:
            return jsonify({'error': 'FETCH_FAILED'}), response.status_code
        
        tokens_data = response.json()
        
        return jsonify({
            'payment_tokens': tokens_data.get('payment_tokens', []),
            'total_items': len(tokens_data.get('payment_tokens', []))
        })
        
    except Exception as e:
        return jsonify({'error': 'FETCH_FAILED'}), 500

@app.route('/paypal-api/vault/payment-tokens/<token_id>', methods=['GET'])
def get_payment_token(token_id):
    try:
        access_token = get_access_token()
        
        response = requests.get(
            f'{PAYPAL_BASE_URL}/v3/vault/payment-tokens/{token_id}',
            headers={
                'Authorization': f'Bearer {access_token}',
                'Content-Type': 'application/json'
            }
        )
        
        if not response.ok:
            return jsonify({'error': 'TOKEN_NOT_FOUND'}), 404
        
        return jsonify(response.json())
        
    except Exception as e:
        return jsonify({'error': 'FETCH_FAILED'}), 500

@app.route('/paypal-api/vault/payment-tokens/<token_id>', methods=['DELETE'])
def delete_payment_token(token_id):
    try:
        access_token = get_access_token()
        
        response = requests.delete(
            f'{PAYPAL_BASE_URL}/v3/vault/payment-tokens/{token_id}',
            headers={
                'Authorization': f'Bearer {access_token}',
                'Content-Type': 'application/json'
            }
        )
        
        if response.status_code == 204:
            return jsonify({
                'success': True,
                'message': 'Payment token deleted successfully'
            })
        
        return jsonify({'success': False}), response.status_code
        
    except Exception as e:
        return jsonify({'error': 'DELETE_FAILED'}), 500
```

