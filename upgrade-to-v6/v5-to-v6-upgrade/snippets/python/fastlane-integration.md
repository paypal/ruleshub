# Fastlane Integration (Server-Side)

## Flask Implementation

```python
app = Flask(__name__)

CORS(app,
     origins="*",
     allow_headers=["Content-Type", "Authorization", "PayPal-Request-Id"],
     methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"])

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

@app.route('/paypal-api/checkout/orders/create', methods=['POST'])
def create_order_fastlane():
    try:
        data = request.get_json()
        access_token = get_access_token()
        
        paypal_request_id = request.headers.get('PayPal-Request-Id', str(uuid.uuid4()))
        
        response = requests.post(
            f'{PAYPAL_BASE_URL}/v2/checkout/orders',
            headers={
                'Content-Type': 'application/json',
                'Authorization': f'Bearer {access_token}',
                'PayPal-Request-Id': paypal_request_id
            },
            json=data
        )
        
        return jsonify(response.json()), response.status_code
        
    except Exception as e:
        return jsonify({'error': 'ORDER_CREATION_FAILED'}), 500

@app.route('/paypal-api/checkout/orders/<order_id>/capture', methods=['POST'])
def capture_order_fastlane(order_id):
    try:
        access_token = get_access_token()
        
        response = requests.post(
            f'{PAYPAL_BASE_URL}/v2/checkout/orders/{order_id}/capture',
            headers={
                'Content-Type': 'application/json',
                'Authorization': f'Bearer {access_token}',
                'PayPal-Request-Id': str(uuid.uuid4())
            },
            json={}
        )
        
        return jsonify(response.json()), response.status_code
        
    except Exception as e:
        return jsonify({'error': 'CAPTURE_FAILED'}), 500
```

