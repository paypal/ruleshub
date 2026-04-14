#### Create Order (Basic)

```python
import uuid
from flask import request, jsonify

@app.route('/paypal-api/checkout/orders/create', methods=['POST'])
def create_order():
    """Create PayPal order for v6 SDK"""
    try:
        body = request.get_json()
        access_token = get_access_token()
        
        headers = {
            'Content-Type': 'application/json',
            'Authorization': f'Bearer {access_token}',
            'PayPal-Request-Id': str(uuid.uuid4())
        }
        
        order_payload = {
            'intent': 'CAPTURE',
            'purchase_units': [{
                'amount': {
                    'currency_code': body.get('currency', 'USD'),
                    'value': body['amount']
                }
            }]
        }
        
        response = requests.post(
            f'{PAYPAL_BASE}/v2/checkout/orders',
            headers=headers,
            json=order_payload
        )
        
        response.raise_for_status()
        order_data = response.json()
        
        return jsonify({
            'id': order_data['id'],
            'status': order_data['status']
        })
        
    except requests.exceptions.RequestException as e:
        error_data = e.response.json() if e.response else {}
        return jsonify({
            'error': 'ORDER_CREATION_FAILED',
            'debugId': e.response.headers.get('PayPal-Debug-Id') if e.response else None,
            'details': error_data
        }), e.response.status_code if e.response else 500
```

#### Create Order with Items

```python
@app.route('/paypal-api/checkout/orders/create-with-details', methods=['POST'])
def create_order_with_details():
    """Create order with item details and breakdown"""
    try:
        body = request.get_json()
        access_token = get_access_token()
        
        headers = {
            'Content-Type': 'application/json',
            'Authorization': f'Bearer {access_token}',
            'PayPal-Request-Id': str(uuid.uuid4())
        }
        
        order_payload = {
            'intent': 'CAPTURE',
            'purchase_units': [{
                'amount': {
                    'currency_code': body.get('currency', 'USD'),
                    'value': body['amount'],
                    'breakdown': {
                        'item_total': {
                            'currency_code': body.get('currency', 'USD'),
                            'value': body.get('details', {}).get('subtotal', body['amount'])
                        },
                        'shipping': {
                            'currency_code': body.get('currency', 'USD'),
                            'value': body.get('details', {}).get('shipping', '0.00')
                        },
                        'tax_total': {
                            'currency_code': body.get('currency', 'USD'),
                            'value': body.get('details', {}).get('tax', '0.00')
                        }
                    }
                },
                'description': body.get('description', 'Purchase'),
                'items': [
                    {
                        'name': item['name'],
                        'quantity': str(item.get('quantity', 1)),
                        'unit_amount': {
                            'currency_code': body.get('currency', 'USD'),
                            'value': item['price']
                        },
                        'sku': item.get('sku')
                    }
                    for item in body.get('items', [])
                ]
            }]
        }
        
        response = requests.post(
            f'{PAYPAL_BASE}/v2/checkout/orders',
            headers=headers,
            json=order_payload
        )
        
        response.raise_for_status()
        order_data = response.json()
        
        return jsonify(order_data)
        
    except requests.exceptions.RequestException as e:
        error_data = e.response.json() if e.response else {}
        return jsonify({
            'error': 'ORDER_CREATION_FAILED',
            'debugId': e.response.headers.get('PayPal-Debug-Id') if e.response else None
        }), e.response.status_code if e.response else 500
```

