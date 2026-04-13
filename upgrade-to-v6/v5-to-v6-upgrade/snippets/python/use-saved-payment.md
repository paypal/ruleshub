# Use Saved Payment (Server-Side)

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

@app.route('/paypal-api/customer/payment-methods', methods=['GET'])
def get_customer_payment_methods():
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

@app.route('/paypal-api/checkout/orders/create-with-saved-card', methods=['POST'])
def create_order_with_saved_card():
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
                'card': {
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

@app.route('/paypal-api/checkout/orders/create-with-saved-paypal', methods=['POST'])
def create_order_with_saved_paypal():
    try:
        data = request.get_json()
        access_token = get_access_token()
        
        payment_token_id = data.get('paymentTokenId')
        
        if not payment_token_id:
            return jsonify({
                'error': 'MISSING_PAYMENT_TOKEN',
                'message': 'paymentTokenId is required'
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
                'paypal': {
                    'vault_id': payment_token_id
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

@app.route('/paypal-api/vault/payment-tokens/<token_id>', methods=['DELETE'])
def delete_saved_payment(token_id):
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
                'message': 'Payment method deleted successfully'
            })
        
        return jsonify({'success': False}), response.status_code
        
    except Exception as e:
        return jsonify({'error': 'DELETE_FAILED'}), 500
```

