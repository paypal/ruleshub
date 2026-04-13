#### Fastlane - Create Order with Single-Use Token

```python
import uuid
from flask import request, jsonify

@app.route('/paypal-api/checkout/orders/create', methods=['POST'])
def create_fastlane_order():
    """Create order with Fastlane single-use token"""
    try:
        body = request.get_json()
        access_token = get_access_token()
        
        paypal_request_id = request.headers.get('PayPal-Request-Id', str(uuid.uuid4()))
        
        headers = {
            'Content-Type': 'application/json',
            'Authorization': f'Bearer {access_token}',
            'PayPal-Request-Id': paypal_request_id
        }
        
        response = requests.post(
            f'{PAYPAL_BASE}/v2/checkout/orders',
            headers=headers,
            json=body
        )
        
        order_data = response.json()
        
        if not response.ok:
            return jsonify(order_data), response.status_code
        
        return jsonify(order_data)
        
    except requests.exceptions.RequestException as e:
        return jsonify({
            'error': {'message': str(e)}
        }), 500
```

#### CORS Configuration for Fastlane

```python
from flask import Flask
from flask_cors import CORS

app = Flask(__name__)

CORS(app, 
     origins="*",
     allow_headers=["Content-Type", "Authorization", "PayPal-Request-Id"],
     methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"])
```

#### Alternative CORS (Manual)

```python
from flask import make_response

@app.after_request
def after_request(response):
    response.headers.add('Access-Control-Allow-Origin', '*')
    response.headers.add('Access-Control-Allow-Headers', 
                         'Content-Type, Authorization, PayPal-Request-Id')
    response.headers.add('Access-Control-Allow-Methods', 
                         'GET, POST, PUT, DELETE, OPTIONS')
    return response

@app.route('/paypal-api/checkout/orders/create', methods=['OPTIONS'])
def preflight():
    """Handle preflight requests"""
    return '', 200
```

