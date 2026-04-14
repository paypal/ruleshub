#### Capture Order

```python
import uuid
from flask import jsonify

@app.route('/paypal-api/checkout/orders/<order_id>/capture', methods=['POST'])
def capture_order(order_id):
    """Capture PayPal order"""
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
        
        return jsonify(capture_data)
        
    except requests.exceptions.RequestException as e:
        error_data = e.response.json() if e.response else {}
        return jsonify({
            'error': 'CAPTURE_FAILED',
            'debugId': e.response.headers.get('PayPal-Debug-Id') if e.response else None,
            'details': error_data
        }), e.response.status_code if e.response else 500
```

