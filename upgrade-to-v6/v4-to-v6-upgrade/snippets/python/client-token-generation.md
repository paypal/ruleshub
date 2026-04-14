#### Generate Client Token for v6 SDK

```python
import os
import base64
import requests
from flask import Flask, jsonify

app = Flask(__name__)

PAYPAL_BASE = os.environ.get('PAYPAL_BASE', 'https://api-m.sandbox.paypal.com')
CLIENT_ID = os.environ['PAYPAL_CLIENT_ID']
CLIENT_SECRET = os.environ['PAYPAL_CLIENT_SECRET']

@app.route('/paypal-api/auth/browser-safe-client-token', methods=['GET'])
def get_client_token():
    """Generate browser-safe client token for v6 SDK initialization"""
    try:
        auth = base64.b64encode(f"{CLIENT_ID}:{CLIENT_SECRET}".encode()).decode()
        
        headers = {
            'Authorization': f'Basic {auth}',
            'Content-Type': 'application/x-www-form-urlencoded'
        }
        
        data = 'grant_type=client_credentials&response_type=client_token&intent=sdk_init'
        
        response = requests.post(
            f'{PAYPAL_BASE}/v1/oauth2/token',
            headers=headers,
            data=data
        )
        response.raise_for_status()
        
        token_data = response.json()
        
        return jsonify({
            'accessToken': token_data['access_token'],
            'expiresIn': token_data.get('expires_in')
        })
        
    except requests.exceptions.RequestException as e:
        error_data = e.response.json() if e.response else {}
        return jsonify({
            'error': 'TOKEN_GENERATION_FAILED',
            'debugId': e.response.headers.get('PayPal-Debug-Id') if e.response else None
        }), 500
```

#### Get OAuth Access Token (for server-side API calls)

```python
def get_access_token():
    """Get OAuth access token for server-side PayPal API calls"""
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
```

