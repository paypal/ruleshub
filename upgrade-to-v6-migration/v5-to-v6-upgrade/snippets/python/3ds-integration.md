# 3D Secure Integration (Server-Side)

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

@app.route('/paypal-api/checkout/orders/create-3ds', methods=['POST'])
def create_order_with_3ds():
    try:
        data = request.get_json()
        access_token = get_access_token()
        
        sca_method = data.get('scaMethod', 'SCA_ALWAYS')
        
        order_payload = {
            'intent': 'CAPTURE',
            'purchase_units': [{
                'amount': {
                    'currency_code': data.get('currency', 'USD'),
                    'value': f"{float(data['amount']):.2f}"
                }
            }],
            'payment_source': {
                'card': {
                    'attributes': {
                        'verification': {
                            'method': sca_method
                        }
                    },
                    'experience_context': {
                        'return_url': data.get('return_url', f"{request.host_url}returnUrl"),
                        'cancel_url': data.get('cancel_url', f"{request.host_url}cancelUrl")
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
        
        order = response.json()
        
        if not response.ok:
            return jsonify(order), response.status_code
        
        return jsonify(order)
        
    except Exception as e:
        return jsonify({'error': 'ORDER_CREATION_FAILED'}), 500

@app.route('/paypal-api/vault/setup-token-3ds', methods=['POST'])
def create_setup_token_with_3ds():
    try:
        data = request.get_json()
        access_token = get_access_token()
        
        sca_method = data.get('scaMethod', 'SCA_WHEN_REQUIRED')
        
        setup_token_payload = {
            'payment_source': {
                'card': {
                    'experience_context': {
                        'return_url': data.get('return_url', f"{request.host_url}returnUrl"),
                        'cancel_url': data.get('cancel_url', f"{request.host_url}cancelUrl")
                    },
                    'verification_method': sca_method
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
        
        return jsonify(response.json())
        
    except Exception as e:
        return jsonify({'error': 'SETUP_TOKEN_FAILED'}), 500

@app.route('/paypal-api/checkout/orders/<order_id>/capture-3ds', methods=['POST'])
def capture_order_with_3ds_logging(order_id):
    try:
        access_token = get_access_token()
        
        response = requests.post(
            f'{PAYPAL_BASE_URL}/v2/checkout/orders/{order_id}/capture',
            headers={
                'Content-Type': 'application/json',
                'Authorization': f'Bearer {access_token}',
                'PayPal-Request-Id': str(uuid.uuid4())
            },
            json={}
        )
        
        capture_data = response.json()
        
        if response.ok:
            auth_result = capture_data.get('payment_source', {}).get('card', {}).get('authentication_result', {})
            
            if auth_result:
                three_ds = auth_result.get('three_d_secure', {})
                
                print('3DS Authentication Result:')
                print(f"  Order ID: {capture_data['id']}")
                print(f"  Liability Shift: {auth_result.get('liability_shift')}")
                print(f"  Auth Status: {three_ds.get('authentication_status')}")
                print(f"  Enrollment Status: {three_ds.get('enrollment_status')}")
        
        return jsonify(capture_data), response.status_code
        
    except Exception as e:
        return jsonify({'error': 'CAPTURE_FAILED'}), 500

@app.route('/paypal-api/checkout/orders/create-3ds-regional', methods=['POST'])
def create_order_with_regional_3ds():
    try:
        data = request.get_json()
        access_token = get_access_token()
        
        order_payload = {
            'intent': 'CAPTURE',
            'purchase_units': [{
                'amount': {
                    'currency_code': data.get('currency', 'EUR'),
                    'value': f"{float(data['amount']):.2f}"
                }
            }],
            'payment_source': {
                'card': {
                    'attributes': {
                        'verification': {
                            'method': 'SCA_WHEN_REQUIRED'
                        }
                    },
                    'experience_context': {
                        'return_url': f"{request.host_url}returnUrl",
                        'cancel_url': f"{request.host_url}cancelUrl"
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
```

