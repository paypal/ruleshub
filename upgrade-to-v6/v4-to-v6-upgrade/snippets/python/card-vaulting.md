#### Create Order with Vault Directive

```python
@app.route('/api/paypal/orders/create-with-vault', methods=['POST'])
def create_order_with_vault():
    """Create order with card vaulting"""
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
            }]
        }
        
        if body.get('saveCard'):
            order_payload['payment_source'] = {
                'card': {
                    'attributes': {
                        'verification': {
                            'method': 'SCA_WHEN_REQUIRED'
                        },
                        'vault': {
                            'store_in_vault': 'ON_SUCCESS',
                            'usage_type': 'MERCHANT',
                            'customer_type': 'CONSUMER',
                            'permit_multiple_payment_tokens': True
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

#### Extract Vault Data from Capture Response

```python
@app.route('/api/paypal/orders/<order_id>/capture', methods=['POST'])
def capture_order_with_vault(order_id):
    """Capture order and extract vault information"""
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
        
        vault_info = capture_data.get('payment_source', {}).get('card', {}).get('attributes', {}).get('vault')
        
        if vault_info:
            save_to_database({
                'vault_id': vault_info['id'],
                'customer_id': vault_info['customer']['id'],
                'card_brand': capture_data['payment_source']['card']['brand'],
                'last_digits': capture_data['payment_source']['card']['last_digits'],
                'expiry': capture_data['payment_source']['card']['expiry']
            })
        
        return jsonify(capture_data)
        
    except requests.exceptions.RequestException as e:
        error_data = e.response.json() if e.response else {}
        return jsonify({'error': 'CAPTURE_FAILED', 'details': error_data}), 500
```

#### List Payment Tokens

```python
@app.route('/api/paypal/vault/payment-tokens', methods=['GET'])
def list_payment_tokens():
    """Get all saved cards for a customer"""
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
        return jsonify(response.json())
        
    except requests.exceptions.RequestException as e:
        error_data = e.response.json() if e.response else {}
        return jsonify({'error': 'FETCH_FAILED', 'details': error_data}), 500
```

#### Create Order with Vault ID

```python
@app.route('/api/paypal/orders/create-with-vault-id', methods=['POST'])
def create_order_with_vault_id():
    """Create order using saved vault ID"""
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
                    'vault_id': body['vaultId']
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
        
        capture_response = requests.post(
            f'{PAYPAL_BASE}/v2/checkout/orders/{order_data["id"]}/capture',
            headers=headers,
            json={}
        )
        
        capture_response.raise_for_status()
        return jsonify(capture_response.json())
        
    except requests.exceptions.RequestException as e:
        error_data = e.response.json() if e.response else {}
        return jsonify({'error': 'PAYMENT_FAILED', 'details': error_data}), 500
```

#### Delete Payment Token

```python
@app.route('/api/paypal/vault/payment-tokens/<token_id>', methods=['DELETE'])
def delete_payment_token(token_id):
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
            return jsonify({'success': True, 'message': 'Card deleted successfully'})
        else:
            return jsonify({'success': False, 'message': 'Failed to delete card'}), response.status_code
            
    except requests.exceptions.RequestException as e:
        return jsonify({'error': 'DELETE_FAILED'}), 500
```

