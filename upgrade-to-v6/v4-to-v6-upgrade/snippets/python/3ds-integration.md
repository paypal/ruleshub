#### Create Order with 3D Secure (Always)

```python
@app.route('/paypal-api/checkout/orders/create-3ds', methods=['POST'])
def create_order_with_3ds():
    """Create order with 3D Secure authentication"""
    try:
        body = request.get_json()
        access_token = get_access_token()
        
        order_payload = {
            'intent': 'CAPTURE',
            'purchase_units': [{
                'amount': {
                    'currency_code': body.get('currency', 'USD'),
                    'value': body['amount']
                }
            }],
            'payment_source': {
                'card': {
                    'attributes': {
                        'verification': {
                            'method': 'SCA_ALWAYS'
                        }
                    },
                    'experience_context': {
                        'return_url': 'https://example.com/returnUrl',
                        'cancel_url': 'https://example.com/cancelUrl'
                    }
                }
            }
        }
        
        headers = {
            'Content-Type': 'application/json',
            'Authorization': f'Bearer {access_token}',
            'PayPal-Request-Id': str(uuid.uuid4())
        }
        
        response = requests.post(
            f'{PAYPAL_BASE}/v2/checkout/orders',
            headers=headers,
            json=order_payload
        )
        
        response.raise_for_status()
        return jsonify(response.json())
        
    except requests.exceptions.RequestException as e:
        error_data = e.response.json() if e.response else {}
        return jsonify({'error': 'ORDER_CREATION_FAILED', 'details': error_data}), 500
```

#### Create Order with 3DS (When Required)

```python
@app.route('/paypal-api/checkout/orders/create-sca', methods=['POST'])
def create_order_with_sca_when_required():
    """Create order with SCA_WHEN_REQUIRED"""
    try:
        body = request.get_json()
        access_token = get_access_token()
        
        order_payload = {
            'intent': 'CAPTURE',
            'purchase_units': [{
                'amount': {
                    'currency_code': body.get('currency', 'USD'),
                    'value': body['amount']
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
                        'return_url': 'https://example.com/returnUrl',
                        'cancel_url': 'https://example.com/cancelUrl'
                    }
                }
            }
        }
        
        headers = {
            'Content-Type': 'application/json',
            'Authorization': f'Bearer {access_token}',
            'PayPal-Request-Id': str(uuid.uuid4())
        }
        
        response = requests.post(
            f'{PAYPAL_BASE}/v2/checkout/orders',
            headers=headers,
            json=order_payload
        )
        
        response.raise_for_status()
        return jsonify(response.json())
        
    except requests.exceptions.RequestException as e:
        error_data = e.response.json() if e.response else {}
        return jsonify({'error': 'ORDER_CREATION_FAILED', 'details': error_data}), 500
```

#### Vault Setup Token with 3DS

```python
@app.route('/paypal-api/vault/setup-token', methods=['POST'])
def create_vault_setup_token_with_3ds():
    """Create vault setup token with 3DS"""
    try:
        body = request.get_json()
        access_token = get_access_token()
        
        setup_token_payload = {
            'payment_source': {
                'card': {
                    'experience_context': {
                        'return_url': 'https://example.com/returnUrl',
                        'cancel_url': 'https://example.com/cancelUrl'
                    },
                    'verification_method': body.get('scaMethod', 'SCA_WHEN_REQUIRED')
                }
            }
        }
        
        headers = {
            'Content-Type': 'application/json',
            'Authorization': f'Bearer {access_token}',
            'PayPal-Request-Id': str(uuid.uuid4())
        }
        
        response = requests.post(
            f'{PAYPAL_BASE}/v3/vault/setup-tokens',
            headers=headers,
            json=setup_token_payload
        )
        
        response.raise_for_status()
        return jsonify(response.json())
        
    except requests.exceptions.RequestException as e:
        error_data = e.response.json() if e.response else {}
        return jsonify({'error': 'SETUP_TOKEN_FAILED', 'details': error_data}), 500
```

#### Log 3DS Authentication Results

```python
@app.route('/api/paypal/orders/<order_id>/capture-3ds', methods=['POST'])
def capture_with_3ds_logging(order_id):
    """Capture order and log 3DS authentication results"""
    try:
        access_token = get_access_token()
        
        headers = {
            'Content-Type': 'application/json',
            'Authorization': f'Bearer {access_token}',
            'PayPal-Request-Id': str(uuid.uuid4())
        }
        
        response = requests.post(
            f'{PAYPAL_BASE}/v2/checkout/orders/{order_id}/capture',
            headers=headers,
            json={}
        )
        
        response.raise_for_status()
        capture_data = response.json()
        
        auth_result = capture_data.get('payment_source', {}).get('card', {}).get('authentication_result', {})
        
        if auth_result:
            three_ds = auth_result.get('three_d_secure', {})
            print(f"3DS Authentication Result:")
            print(f"  Order ID: {capture_data['id']}")
            print(f"  Liability Shift: {auth_result.get('liability_shift')}")
            print(f"  Auth Status: {three_ds.get('authentication_status')}")
            print(f"  Enrollment Status: {three_ds.get('enrollment_status')}")
        
        return jsonify(capture_data)
        
    except requests.exceptions.RequestException as e:
        error_data = e.response.json() if e.response else {}
        return jsonify({'error': 'CAPTURE_FAILED', 'details': error_data}), 500
```

