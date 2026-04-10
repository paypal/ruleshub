# Save Payment Button (Server-Side)

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

@app.route('/paypal-api/vault/setup-tokens/create', methods=['POST'])
def create_setup_token_for_save():
    try:
        data = request.get_json()
        access_token = get_access_token()
        
        payment_method = data.get('payment_method', 'paypal')
        
        if payment_method == 'paypal':
            setup_token_payload = {
                'payment_source': {
                    'paypal': {
                        'usage_type': 'MERCHANT',
                        'customer_type': 'CONSUMER',
                        'permit_multiple_payment_tokens': True
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
                        'verification_method': 'SCA_WHEN_REQUIRED'
                    }
                }
            }
        else:
            return jsonify({
                'error': 'INVALID_PAYMENT_METHOD',
                'message': 'Payment method must be paypal or card'
            }), 400
        
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
            return jsonify(error_data), response.status_code
        
        setup_data = response.json()
        
        return jsonify({
            'id': setup_data['id'],
            'status': setup_data['status']
        })
        
    except Exception as e:
        return jsonify({'error': 'SETUP_TOKEN_FAILED'}), 500

@app.route('/paypal-api/vault/payment-tokens/create', methods=['POST'])
def create_payment_token_from_setup():
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
            return jsonify(error_data), response.status_code
        
        token_data = response.json()
        
        return jsonify({
            'id': token_data['id'],
            'customerId': token_data.get('customer', {}).get('id'),
            'status': 'saved'
        })
        
    except Exception as e:
        return jsonify({'error': 'PAYMENT_TOKEN_FAILED'}), 500

@app.route('/paypal-api/customer/payment-methods', methods=['GET'])
def get_saved_payment_methods():
    try:
        customer_id = request.args.get('customer_id')
        
        if not customer_id:
            return jsonify({
                'error': 'MISSING_CUSTOMER_ID',
                'message': 'customer_id is required'
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
```

