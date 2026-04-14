#### Complete Flask Server for v6 SDK

```python
import os
import base64
import uuid
import requests
from flask import Flask, request, jsonify
from flask_cors import CORS

app = Flask(__name__)

CORS(app, 
     origins="*",
     allow_headers=["Content-Type", "Authorization", "PayPal-Request-Id"],
     methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"])

PAYPAL_BASE = os.environ.get('PAYPAL_BASE', 'https://api-m.sandbox.paypal.com')
CLIENT_ID = os.environ['PAYPAL_CLIENT_ID']
CLIENT_SECRET = os.environ['PAYPAL_CLIENT_SECRET']

def get_access_token():
    """Get OAuth access token"""
    auth = base64.b64encode(f"{CLIENT_ID}:{CLIENT_SECRET}".encode()).decode()
    
    headers = {
        'Authorization': f'Basic {auth}',
        'Content-Type': 'application/x-www-form-urlencoded'
    }
    
    response = requests.post(
        f'{PAYPAL_BASE}/v1/oauth2/token',
        headers=headers,
        data='grant_type=client_credentials'
    )
    response.raise_for_status()
    return response.json()['access_token']

@app.route('/paypal-api/auth/browser-safe-client-token', methods=['GET'])
def get_client_token():
    """Generate client token for v6 SDK"""
    try:
        auth = base64.b64encode(f"{CLIENT_ID}:{CLIENT_SECRET}".encode()).decode()
        
        headers = {
            'Authorization': f'Basic {auth}',
            'Content-Type': 'application/x-www-form-urlencoded'
        }
        
        response = requests.post(
            f'{PAYPAL_BASE}/v1/oauth2/token',
            headers=headers,
            data='grant_type=client_credentials&response_type=client_token&intent=sdk_init'
        )
        response.raise_for_status()
        
        token_data = response.json()
        return jsonify({'accessToken': token_data['access_token']})
        
    except requests.exceptions.RequestException as e:
        return jsonify({'error': 'TOKEN_GENERATION_FAILED'}), 500

@app.route('/paypal-api/checkout/orders/create', methods=['POST'])
def create_order():
    """Create PayPal order"""
    try:
        body = request.get_json()
        access_token = get_access_token()
        
        paypal_request_id = request.headers.get('Paypal-Request-Id', str(uuid.uuid4()))
        
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
        return jsonify({'error': 'ORDER_CREATION_FAILED'}), 500

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
        return jsonify(response.json())
        
    except requests.exceptions.RequestException as e:
        error_data = e.response.json() if e.response else {}
        return jsonify({'error': 'CAPTURE_FAILED', 'details': error_data}), 500

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=3000, debug=True)
```

#### Environment Variables (.env)

```bash
PAYPAL_CLIENT_ID=your_client_id_here
PAYPAL_CLIENT_SECRET=your_client_secret_here
PAYPAL_BASE=https://api-m.sandbox.paypal.com
```

#### Requirements (requirements.txt)

```
Flask==3.0.0
flask-cors==4.0.0
requests==2.31.0
python-dotenv==1.0.0
```

#### Load Environment Variables

```python
from dotenv import load_dotenv
load_dotenv()
```

