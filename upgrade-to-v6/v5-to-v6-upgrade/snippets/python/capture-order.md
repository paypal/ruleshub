# Capture Order (Server-Side)

## Flask Implementation

```python
app = Flask(__name__)

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

@app.route('/paypal-api/checkout/orders/<order_id>/capture', methods=['POST'])
def capture_order(order_id):
    try:
        if not order_id:
            return jsonify({
                'error': 'INVALID_ORDER_ID',
                'message': 'Order ID is required'
            }), 400
        
        print(f'Capturing order: {order_id}')
        
        access_token = get_access_token()
        
        order_response = requests.get(
            f'{PAYPAL_BASE_URL}/v2/checkout/orders/{order_id}',
            headers={
                'Authorization': f'Bearer {access_token}'
            }
        )
        
        if not order_response.ok:
            return jsonify({
                'error': 'ORDER_NOT_FOUND',
                'message': 'Order not found'
            }), 404
        
        order_data = order_response.json()
        
        if order_data['status'] != 'APPROVED':
            return jsonify({
                'error': 'ORDER_NOT_APPROVED',
                'message': f"Order status is {order_data['status']}, not APPROVED",
                'orderId': order_id
            }), 400
        
        order_amount = order_data['purchase_units'][0]['amount']['value']
        print(f'Order amount: {order_amount}')
        
        capture_response = requests.post(
            f'{PAYPAL_BASE_URL}/v2/checkout/orders/{order_id}/capture',
            headers={
                'Content-Type': 'application/json',
                'Authorization': f'Bearer {access_token}',
                'PayPal-Request-Id': str(uuid.uuid4())
            },
            json={}
        )
        
        capture_data = capture_response.json()
        
        if not capture_response.ok:
            debug_id = capture_response.headers.get('PayPal-Debug-Id')
            
            if capture_response.status_code == 422:
                return jsonify({
                    'error': 'ORDER_ALREADY_CAPTURED',
                    'message': capture_data.get('message', 'Order cannot be captured'),
                    'debugId': debug_id,
                    'details': capture_data.get('details')
                }), 422
            
            return jsonify({
                'error': 'CAPTURE_FAILED',
                'message': capture_data.get('message', 'Failed to capture order'),
                'debugId': debug_id,
                'details': capture_data.get('details')
            }), capture_response.status_code
        
        print(f"Order captured successfully: {capture_data['id']}, status: {capture_data['status']}")
        
        capture = capture_data['purchase_units'][0]['payments']['captures'][0]
        
        return jsonify({
            'id': capture_data['id'],
            'status': capture_data['status'],
            'captureId': capture['id'],
            'amount': capture['amount'],
            'payer': capture_data.get('payer'),
            'create_time': capture.get('create_time')
        })
        
    except requests.exceptions.RequestException as e:
        error_data = e.response.json() if e.response else {}
        debug_id = e.response.headers.get('PayPal-Debug-Id') if e.response else None
        
        print(f'Error capturing order: {error_data}')
        
        return jsonify({
            'error': 'CAPTURE_FAILED',
            'message': error_data.get('message', 'Failed to capture order'),
            'debugId': debug_id,
            'details': error_data.get('details')
        }), e.response.status_code if e.response else 500
```

## Simple Capture

```python
@app.route('/paypal-api/checkout/orders/<order_id>/capture', methods=['POST'])
def capture_order_simple(order_id):
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
        
        return jsonify(response.json())
        
    except Exception as e:
        return jsonify({'error': 'CAPTURE_FAILED'}), 500
```

