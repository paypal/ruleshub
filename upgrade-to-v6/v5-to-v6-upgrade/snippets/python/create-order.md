# Create Order (Server-Side)

## Flask Implementation

```python
app = Flask(__name__)
app.config['JSON_SORT_KEYS'] = False

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
def create_order():
    try:
        data = request.get_json()
        
        amount = data.get('amount')
        currency = data.get('currency', 'USD')
        items = data.get('items', [])
        custom_id = data.get('custom_id')
        invoice_id = data.get('invoice_id')
        description = data.get('description')
        
        if not amount or float(amount) <= 0:
            return jsonify({
                'error': 'INVALID_AMOUNT',
                'message': 'Invalid or missing amount'
            }), 400
        
        access_token = get_access_token()
        
        order_payload = {
            'intent': 'CAPTURE',
            'purchase_units': [{
                'amount': {
                    'currency_code': currency,
                    'value': f"{float(amount):.2f}"
                }
            }]
        }
        
        if description:
            order_payload['purchase_units'][0]['description'] = description
        
        if custom_id:
            order_payload['purchase_units'][0]['custom_id'] = custom_id
            
        if invoice_id:
            order_payload['purchase_units'][0]['invoice_id'] = invoice_id
        
        if items:
            item_total = sum(float(item['price']) * int(item.get('quantity', 1)) for item in items)
            order_payload['purchase_units'][0]['amount']['breakdown'] = {
                'item_total': {
                    'currency_code': currency,
                    'value': f"{item_total:.2f}"
                }
            }
            order_payload['purchase_units'][0]['items'] = [
                {
                    'name': item['name'],
                    'quantity': str(item.get('quantity', 1)),
                    'unit_amount': {
                        'currency_code': currency,
                        'value': f"{float(item['price']):.2f}"
                    },
                    'sku': item.get('sku')
                }
                for item in items
            ]
        
        order_payload['payment_source'] = {
            'paypal': {
                'experience_context': {
                    'payment_method_preference': 'IMMEDIATE_PAYMENT_REQUIRED',
                    'brand_name': 'Your Store Name',
                    'locale': 'en-US',
                    'landing_page': 'LOGIN',
                    'shipping_preference': 'NO_SHIPPING',
                    'user_action': 'PAY_NOW',
                    'return_url': f"{request.host_url}success",
                    'cancel_url': f"{request.host_url}cancel"
                }
            }
        }
        
        print(f'Creating PayPal order')
        
        response = requests.post(
            f'{PAYPAL_BASE_URL}/v2/checkout/orders',
            headers={
                'Content-Type': 'application/json',
                'Authorization': f'Bearer {access_token}',
                'PayPal-Request-Id': str(uuid.uuid4())
            },
            json=order_payload
        )
        
        order = response.json()
        
        if not response.ok:
            return jsonify(order), response.status_code
        
        print(f"Order created: {order['id']}, status: {order['status']}")
        
        return jsonify({
            'id': order['id'],
            'status': order['status'],
            'links': order.get('links')
        })
        
    except requests.exceptions.RequestException as e:
        error_data = e.response.json() if e.response else {}
        debug_id = e.response.headers.get('PayPal-Debug-Id') if e.response else None
        
        print(f'Error creating order: {error_data}')
        
        return jsonify({
            'error': 'ORDER_CREATION_FAILED',
            'message': error_data.get('message', 'Failed to create order'),
            'debugId': debug_id,
            'details': error_data.get('details')
        }), e.response.status_code if e.response else 500
```

## Simple Order Creation

```python
@app.route('/paypal-api/checkout/orders/create', methods=['POST'])
def create_order_simple():
    try:
        data = request.get_json()
        access_token = get_access_token()
        
        amount = data.get('amount', '10.00')
        currency = data.get('currency', 'USD')
        
        response = requests.post(
            f'{PAYPAL_BASE_URL}/v2/checkout/orders',
            headers={
                'Content-Type': 'application/json',
                'Authorization': f'Bearer {access_token}'
            },
            json={
                'intent': 'CAPTURE',
                'purchase_units': [{
                    'amount': {
                        'currency_code': currency,
                        'value': amount
                    }
                }]
            }
        )
        
        order = response.json()
        return jsonify({'id': order['id'], 'status': order['status']})
        
    except Exception as e:
        return jsonify({'error': 'ORDER_CREATION_FAILED'}), 500
```

