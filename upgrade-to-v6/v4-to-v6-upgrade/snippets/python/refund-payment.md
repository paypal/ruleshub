#### Full Refund

```python
@app.route('/paypal-api/payments/captures/<capture_id>/refund', methods=['POST'])
def refund_payment(capture_id):
    """Issue full refund"""
    try:
        access_token = get_access_token()
        
        headers = {
            'Content-Type': 'application/json',
            'Authorization': f'Bearer {access_token}',
            'PayPal-Request-Id': str(uuid.uuid4())
        }
        
        response = requests.post(
            f'{PAYPAL_BASE}/v2/payments/captures/{capture_id}/refund',
            headers=headers,
            json={}
        )
        
        response.raise_for_status()
        return jsonify(response.json())
        
    except requests.exceptions.RequestException as e:
        error_data = e.response.json() if e.response else {}
        return jsonify({'error': 'REFUND_FAILED', 'details': error_data}), 500
```

#### Partial Refund

```python
@app.route('/paypal-api/payments/captures/<capture_id>/refund-partial', methods=['POST'])
def refund_payment_partial(capture_id):
    """Issue partial refund"""
    try:
        body = request.get_json()
        access_token = get_access_token()
        
        refund_payload = {
            'amount': {
                'value': body['amount'],
                'currency_code': body.get('currency', 'USD')
            }
        }
        
        if body.get('note'):
            refund_payload['note_to_payer'] = body['note']
        
        if body.get('invoiceId'):
            refund_payload['invoice_id'] = body['invoiceId']
        
        headers = {
            'Content-Type': 'application/json',
            'Authorization': f'Bearer {access_token}',
            'PayPal-Request-Id': str(uuid.uuid4())
        }
        
        response = requests.post(
            f'{PAYPAL_BASE}/v2/payments/captures/{capture_id}/refund',
            headers=headers,
            json=refund_payload
        )
        
        response.raise_for_status()
        refund_data = response.json()
        
        return jsonify({
            'refundId': refund_data['id'],
            'status': refund_data['status'],
            'amount': refund_data['amount'],
            'details': refund_data
        })
        
    except requests.exceptions.RequestException as e:
        error_data = e.response.json() if e.response else {}
        return jsonify({'error': 'REFUND_FAILED', 'details': error_data}), 500
```

#### Get Refund Details

```python
@app.route('/paypal-api/payments/refunds/<refund_id>', methods=['GET'])
def get_refund_details(refund_id):
    """Get refund details and status"""
    try:
        access_token = get_access_token()
        
        headers = {
            'Content-Type': 'application/json',
            'Authorization': f'Bearer {access_token}'
        }
        
        response = requests.get(
            f'{PAYPAL_BASE}/v2/payments/refunds/{refund_id}',
            headers=headers
        )
        
        response.raise_for_status()
        return jsonify(response.json())
        
    except requests.exceptions.RequestException as e:
        error_data = e.response.json() if e.response else {}
        return jsonify({'error': 'FETCH_FAILED', 'details': error_data}), 500
```

#### Get Capture Details (to get capture ID for refund)

```python
@app.route('/paypal-api/checkout/orders/<order_id>/details', methods=['GET'])
def get_order_details_for_refund(order_id):
    """Get order details to extract capture ID"""
    try:
        access_token = get_access_token()
        
        headers = {
            'Content-Type': 'application/json',
            'Authorization': f'Bearer {access_token}'
        }
        
        response = requests.get(
            f'{PAYPAL_BASE}/v2/checkout/orders/{order_id}',
            headers=headers
        )
        
        response.raise_for_status()
        order_data = response.json()
        
        captures = order_data.get('purchase_units', [{}])[0].get('payments', {}).get('captures', [])
        capture_id = captures[0]['id'] if captures else None
        
        return jsonify({
            'orderId': order_id,
            'captureId': capture_id,
            'status': order_data['status'],
            'details': order_data
        })
        
    except requests.exceptions.RequestException as e:
        error_data = e.response.json() if e.response else {}
        return jsonify({'error': 'FETCH_FAILED', 'details': error_data}), 500
```

