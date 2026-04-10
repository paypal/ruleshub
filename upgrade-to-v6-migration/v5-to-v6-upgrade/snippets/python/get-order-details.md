# Get Order Details (Server-Side)

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

@app.route('/paypal-api/checkout/orders/<order_id>', methods=['GET'])
def get_order_details(order_id):
    try:
        if not order_id:
            return jsonify({
                'error': 'INVALID_ORDER_ID',
                'message': 'Order ID is required'
            }), 400
        
        print(f'Fetching order details: {order_id}')
        
        access_token = get_access_token()
        
        response = requests.get(
            f'{PAYPAL_BASE_URL}/v2/checkout/orders/{order_id}',
            headers={
                'Authorization': f'Bearer {access_token}',
                'Content-Type': 'application/json'
            }
        )
        
        if not response.ok:
            error_data = response.json()
            debug_id = response.headers.get('PayPal-Debug-Id')
            
            if response.status_code == 404:
                return jsonify({
                    'error': 'ORDER_NOT_FOUND',
                    'message': 'Order not found',
                    'debugId': debug_id
                }), 404
            
            return jsonify({
                'error': 'FETCH_FAILED',
                'message': error_data.get('message', 'Failed to fetch order'),
                'debugId': debug_id
            }), response.status_code
        
        order_data = response.json()
        
        print(f"Order details retrieved: {order_data['id']}, status: {order_data['status']}")
        
        return jsonify(order_data)
        
    except requests.exceptions.RequestException as e:
        error_data = e.response.json() if e.response else {}
        debug_id = e.response.headers.get('PayPal-Debug-Id') if e.response else None
        
        print(f'Error fetching order: {error_data}')
        
        return jsonify({
            'error': 'FETCH_FAILED',
            'message': 'Failed to fetch order details',
            'debugId': debug_id
        }), e.response.status_code if e.response else 500

@app.route('/paypal-api/checkout/orders/<order_id>/summary', methods=['GET'])
def get_order_summary(order_id):
    try:
        access_token = get_access_token()
        
        response = requests.get(
            f'{PAYPAL_BASE_URL}/v2/checkout/orders/{order_id}',
            headers={'Authorization': f'Bearer {access_token}'}
        )
        
        if not response.ok:
            return jsonify({'error': 'ORDER_NOT_FOUND'}), 404
        
        order_data = response.json()
        
        captures = order_data.get('purchase_units', [{}])[0].get('payments', {}).get('captures', [])
        authorizations = order_data.get('purchase_units', [{}])[0].get('payments', {}).get('authorizations', [])
        
        summary = {
            'id': order_data['id'],
            'status': order_data['status'],
            'amount': order_data['purchase_units'][0]['amount'],
            'payer': order_data.get('payer'),
            'captureId': captures[0]['id'] if captures else None,
            'authorizationId': authorizations[0]['id'] if authorizations else None,
            'create_time': order_data.get('create_time'),
            'update_time': order_data.get('update_time')
        }
        
        return jsonify(summary)
        
    except Exception as e:
        return jsonify({'error': 'FETCH_FAILED'}), 500
```

