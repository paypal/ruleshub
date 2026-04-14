#### Create Order with AUTHORIZE Intent

```python
@app.route('/paypal-api/checkout/orders/create-authorize', methods=['POST'])
def create_order_authorize():
    """Create order with AUTHORIZE intent (capture funds later)"""
    try:
        body = request.get_json()
        access_token = get_access_token()
        
        order_payload = {
            'intent': 'AUTHORIZE',  # v4: 'authorize', v6: 'AUTHORIZE'
            'purchase_units': [{
                'amount': {
                    'currency_code': body.get('currency', 'USD'),
                    'value': body['amount']
                }
            }]
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

#### Authorize Order (After Buyer Approval)

```python
@app.route('/paypal-api/checkout/orders/<order_id>/authorize', methods=['POST'])
def authorize_order(order_id):
    """Authorize order after buyer approval"""
    try:
        access_token = get_access_token()
        
        headers = {
            'Content-Type': 'application/json',
            'Authorization': f'Bearer {access_token}',
            'PayPal-Request-Id': str(uuid.uuid4())
        }
        
        response = requests.post(
            f'{PAYPAL_BASE}/v2/checkout/orders/{order_id}/authorize',
            headers=headers,
            json={}
        )
        
        response.raise_for_status()
        auth_data = response.json()
        
        authorization_id = auth_data['purchase_units'][0]['payments']['authorizations'][0]['id']
        
        return jsonify({
            'authorizationId': authorization_id,
            'status': auth_data['status'],
            'details': auth_data
        })
        
    except requests.exceptions.RequestException as e:
        error_data = e.response.json() if e.response else {}
        return jsonify({'error': 'AUTHORIZATION_FAILED', 'details': error_data}), 500
```

#### Capture Authorization

```python
@app.route('/paypal-api/payments/authorizations/<authorization_id>/capture', methods=['POST'])
def capture_authorization(authorization_id):
    """Capture authorized payment"""
    try:
        body = request.get_json() or {}
        access_token = get_access_token()
        
        capture_payload = {}
        
        if body.get('amount'):
            capture_payload['amount'] = {
                'value': body['amount'],
                'currency_code': body.get('currency', 'USD')
            }
        
        capture_payload['final_capture'] = body.get('finalCapture', True)
        
        if body.get('invoiceId'):
            capture_payload['invoice_id'] = body['invoiceId']
        
        if body.get('noteToPayer'):
            capture_payload['note_to_payer'] = body['noteToPayer']
        
        headers = {
            'Content-Type': 'application/json',
            'Authorization': f'Bearer {access_token}',
            'PayPal-Request-Id': str(uuid.uuid4())
        }
        
        response = requests.post(
            f'{PAYPAL_BASE}/v2/payments/authorizations/{authorization_id}/capture',
            headers=headers,
            json=capture_payload
        )
        
        response.raise_for_status()
        return jsonify(response.json())
        
    except requests.exceptions.RequestException as e:
        error_data = e.response.json() if e.response else {}
        return jsonify({'error': 'CAPTURE_FAILED', 'details': error_data}), 500
```

#### Get Authorization Details

```python
@app.route('/paypal-api/payments/authorizations/<authorization_id>', methods=['GET'])
def get_authorization_details(authorization_id):
    """Get authorization details and status"""
    try:
        access_token = get_access_token()
        
        headers = {
            'Content-Type': 'application/json',
            'Authorization': f'Bearer {access_token}'
        }
        
        response = requests.get(
            f'{PAYPAL_BASE}/v2/payments/authorizations/{authorization_id}',
            headers=headers
        )
        
        response.raise_for_status()
        auth_data = response.json()
        
        return jsonify({
            'id': auth_data['id'],
            'status': auth_data['status'],
            'amount': auth_data['amount'],
            'expirationTime': auth_data.get('expiration_time'),
            'details': auth_data
        })
        
    except requests.exceptions.RequestException as e:
        error_data = e.response.json() if e.response else {}
        return jsonify({'error': 'FETCH_FAILED', 'details': error_data}), 500
```

