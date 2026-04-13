#### Create Setup Token (Save PayPal Without Purchase)

```python
@app.route('/paypal-api/vault/setup-token/create', methods=['POST'])
def create_setup_token():
    """Create setup token for saving PayPal account without purchase"""
    try:
        access_token = get_access_token()
        
        setup_token_payload = {
            'payment_source': {
                'paypal': {
                    'usage_type': 'MERCHANT',
                    'customer_type': 'CONSUMER',
                    'permit_multiple_payment_tokens': True
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
        setup_data = response.json()
        
        return jsonify({
            'id': setup_data['id'],
            'status': setup_data.get('status')
        })
        
    except requests.exceptions.RequestException as e:
        error_data = e.response.json() if e.response else {}
        return jsonify({'error': 'SETUP_TOKEN_FAILED', 'details': error_data}), 500
```

#### Create Payment Token from Setup Token

```python
@app.route('/paypal-api/vault/payment-token/create', methods=['POST'])
def create_payment_token():
    """Create payment token from vault setup token"""
    try:
        body = request.get_json()
        access_token = get_access_token()
        
        payment_token_payload = {
            'payment_source': {
                'token': {
                    'id': body['vaultSetupToken'],
                    'type': 'SETUP_TOKEN'
                }
            }
        }
        
        headers = {
            'Content-Type': 'application/json',
            'Authorization': f'Bearer {access_token}',
            'PayPal-Request-Id': str(uuid.uuid4())
        }
        
        response = requests.post(
            f'{PAYPAL_BASE}/v3/vault/payment-tokens',
            headers=headers,
            json=payment_token_payload
        )
        
        response.raise_for_status()
        token_data = response.json()
        
        payment_token_id = token_data['id']
        customer_id = token_data['customer']['id']
        
        save_to_database({
            'payment_token_id': payment_token_id,
            'customer_id': customer_id,
            'user_id': body.get('userId'),
            'created_at': token_data.get('create_time')
        })
        
        return jsonify({
            'id': payment_token_id,
            'customerId': customer_id,
            'status': 'saved'
        })
        
    except requests.exceptions.RequestException as e:
        error_data = e.response.json() if e.response else {}
        return jsonify({'error': 'PAYMENT_TOKEN_FAILED', 'details': error_data}), 500
```

#### Create Order with Saved PayPal (Payment Token)

```python
@app.route('/paypal-api/checkout/orders/create-with-payment-token', methods=['POST'])
def create_order_with_payment_token():
    """Create order using saved PayPal payment token"""
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
                'paypal': {
                    'vault_id': body['paymentTokenId']
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
        order_data = response.json()
        
        if order_data['status'] == 'CREATED':
            capture_response = requests.post(
                f'{PAYPAL_BASE}/v2/checkout/orders/{order_data["id"]}/capture',
                headers=headers,
                json={}
            )
            capture_response.raise_for_status()
            return jsonify(capture_response.json())
        
        return jsonify(order_data)
        
    except requests.exceptions.RequestException as e:
        error_data = e.response.json() if e.response else {}
        return jsonify({'error': 'ORDER_FAILED', 'details': error_data}), 500
```

#### List Saved Payment Methods

```python
@app.route('/paypal-api/customer/payment-methods', methods=['GET'])
def list_payment_methods():
    """Get all saved payment methods for a customer"""
    try:
        customer_id = request.args.get('customer_id')
        access_token = get_access_token()
        
        headers = {
            'Content-Type': 'application/json',
            'Authorization': f'Bearer {access_token}'
        }
        
        response = requests.get(
            f'{PAYPAL_BASE}/v3/vault/payment-tokens?customer_id={customer_id}',
            headers=headers
        )
        
        response.raise_for_status()
        tokens_data = response.json()
        
        return jsonify({
            'payment_tokens': tokens_data.get('payment_tokens', []),
            'total_items': len(tokens_data.get('payment_tokens', []))
        })
        
    except requests.exceptions.RequestException as e:
        error_data = e.response.json() if e.response else {}
        return jsonify({'error': 'FETCH_FAILED', 'details': error_data}), 500
```

#### Delete Saved Payment Method

```python
@app.route('/paypal-api/vault/payment-tokens/<token_id>', methods=['DELETE'])
def delete_payment_method(token_id):
    """Delete saved payment token"""
    try:
        access_token = get_access_token()
        
        headers = {
            'Content-Type': 'application/json',
            'Authorization': f'Bearer {access_token}'
        }
        
        response = requests.delete(
            f'{PAYPAL_BASE}/v3/vault/payment-tokens/{token_id}',
            headers=headers
        )
        
        if response.status_code == 204:
            delete_from_database(token_id)
            return jsonify({'success': True, 'message': 'Payment method deleted'})
        else:
            return jsonify({'success': False}), response.status_code
            
    except requests.exceptions.RequestException as e:
        return jsonify({'error': 'DELETE_FAILED'}), 500
```

