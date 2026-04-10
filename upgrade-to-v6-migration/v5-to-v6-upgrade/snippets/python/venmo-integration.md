# Venmo Integration (Server-Side)

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

@app.route('/paypal-api/checkout/orders/create-venmo', methods=['POST'])
def create_order_for_venmo():
    try:
        data = request.get_json()
        access_token = get_access_token()
        
        order_payload = {
            'intent': 'CAPTURE',
            'purchase_units': [{
                'amount': {
                    'currency_code': data.get('currency', 'USD'),
                    'value': f"{float(data['amount']):.2f}"
                }
            }],
            'payment_source': {
                'venmo': {
                    'experience_context': {
                        'payment_method_preference': 'IMMEDIATE_PAYMENT_REQUIRED',
                        'brand_name': data.get('brand_name', 'Your Store'),
                        'shipping_preference': 'NO_SHIPPING',
                        'user_action': 'PAY_NOW'
                    }
                }
            }
        }
        
        response = requests.post(
            f'{PAYPAL_BASE_URL}/v2/checkout/orders',
            headers={
                'Content-Type': 'application/json',
                'Authorization': f'Bearer {access_token}',
                'PayPal-Request-Id': str(uuid.uuid4())
            },
            json=order_payload
        )
        
        return jsonify(response.json()), response.status_code
        
    except Exception as e:
        return jsonify({'error': 'ORDER_CREATION_FAILED'}), 500

@app.route('/paypal-api/vault/setup-tokens/venmo', methods=['POST'])
def create_venmo_setup_token():
    try:
        data = request.get_json()
        access_token = get_access_token()
        
        setup_token_payload = {
            'payment_source': {
                'venmo': {
                    'usage_type': 'MERCHANT',
                    'customer_type': 'CONSUMER',
                    'permit_multiple_payment_tokens': True
                }
            }
        }
        
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

@app.route('/paypal-api/checkout/orders/create-with-saved-venmo', methods=['POST'])
def create_order_with_saved_venmo():
    try:
        data = request.get_json()
        access_token = get_access_token()
        
        vault_id = data.get('vaultId')
        
        if not vault_id:
            return jsonify({
                'error': 'MISSING_VAULT_ID',
                'message': 'vaultId is required'
            }), 400
        
        order_payload = {
            'intent': 'CAPTURE',
            'purchase_units': [{
                'amount': {
                    'currency_code': data.get('currency', 'USD'),
                    'value': f"{float(data['amount']):.2f}"
                }
            }],
            'payment_source': {
                'venmo': {
                    'vault_id': vault_id
                }
            }
        }
        
        order_response = requests.post(
            f'{PAYPAL_BASE_URL}/v2/checkout/orders',
            headers={
                'Content-Type': 'application/json',
                'Authorization': f'Bearer {access_token}',
                'PayPal-Request-Id': str(uuid.uuid4())
            },
            json=order_payload
        )
        
        order_data = order_response.json()
        
        if not order_response.ok:
            return jsonify(order_data), order_response.status_code
        
        if order_data['status'] == 'CREATED':
            capture_response = requests.post(
                f"{PAYPAL_BASE_URL}/v2/checkout/orders/{order_data['id']}/capture",
                headers={
                    'Content-Type': 'application/json',
                    'Authorization': f'Bearer {access_token}',
                    'PayPal-Request-Id': str(uuid.uuid4())
                },
                json={}
            )
            
            return jsonify(capture_response.json())
        
        return jsonify(order_data)
        
    except Exception as e:
        return jsonify({'error': 'PAYMENT_FAILED'}), 500
```

