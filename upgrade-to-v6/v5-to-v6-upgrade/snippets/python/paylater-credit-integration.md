# Pay Later & Credit Integration (Server-Side)

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

@app.route('/paypal-api/checkout/orders/create-paylater', methods=['POST'])
def create_order_for_paylater():
    try:
        data = request.get_json()
        access_token = get_access_token()
        
        order_payload = {
            'intent': 'CAPTURE',
            'purchase_units': [{
                'amount': {
                    'currency_code': data.get('currency', 'USD'),
                    'value': f"{float(data['amount']):.2f}"
                },
                'description': data.get('description', 'Purchase')
            }],
            'payment_source': {
                'pay_upon_invoice': {
                    'experience_context': {
                        'payment_method_preference': 'IMMEDIATE_PAYMENT_REQUIRED',
                        'brand_name': data.get('brand_name', 'Your Store'),
                        'locale': 'en-US',
                        'shipping_preference': 'NO_SHIPPING',
                        'user_action': 'PAY_NOW',
                        'return_url': f"{request.host_url}success",
                        'cancel_url': f"{request.host_url}cancel"
                    }
                }
            }
        }
        
        response = requests.post(
            f'{PAYPAL_BASE_URL}/v2/checkout/orders',
            headers={
                'Content-Type': 'application/json',
                'Authorization': f'Bearer {access_token}',
                'PayPal-Request-Id': str(uuid.uuid4())
            },
            json=order_payload
        )
        
        return jsonify(response.json()), response.status_code
        
    except Exception as e:
        return jsonify({'error': 'ORDER_CREATION_FAILED'}), 500

@app.route('/paypal-api/checkout/orders/create-credit', methods=['POST'])
def create_order_for_credit():
    try:
        data = request.get_json()
        access_token = get_access_token()
        
        order_payload = {
            'intent': 'CAPTURE',
            'purchase_units': [{
                'amount': {
                    'currency_code': data.get('currency', 'USD'),
                    'value': f"{float(data['amount']):.2f}",
                    'breakdown': {
                        'item_total': {
                            'currency_code': data.get('currency', 'USD'),
                            'value': f"{float(data['amount']):.2f}"
                        }
                    }
                },
                'items': data.get('items', [])
            }],
            'payment_source': {
                'paypal': {
                    'experience_context': {
                        'payment_method_preference': 'IMMEDIATE_PAYMENT_REQUIRED',
                        'brand_name': data.get('brand_name', 'Your Store'),
                        'locale': 'en-US',
                        'landing_page': 'LOGIN',
                        'shipping_preference': 'NO_SHIPPING',
                        'user_action': 'PAY_NOW',
                        'return_url': f"{request.host_url}success",
                        'cancel_url': f"{request.host_url}cancel"
                    }
                }
            }
        }
        
        response = requests.post(
            f'{PAYPAL_BASE_URL}/v2/checkout/orders',
            headers={
                'Content-Type': 'application/json',
                'Authorization': f'Bearer {access_token}',
                'PayPal-Request-Id': str(uuid.uuid4())
            },
            json=order_payload
        )
        
        return jsonify(response.json()), response.status_code
        
    except Exception as e:
        return jsonify({'error': 'ORDER_CREATION_FAILED'}), 500

@app.route('/paypal-api/checkout/orders/create-installments', methods=['POST'])
def create_order_with_installments():
    try:
        data = request.get_json()
        access_token = get_access_token()
        
        order_payload = {
            'intent': 'CAPTURE',
            'purchase_units': [{
                'amount': {
                    'currency_code': data.get('currency', 'USD'),
                    'value': f"{float(data['amount']):.2f}"
                }
            }],
            'payment_source': {
                'paypal': {
                    'experience_context': {
                        'payment_method_preference': 'IMMEDIATE_PAYMENT_REQUIRED',
                        'brand_name': data.get('brand_name', 'Your Store'),
                        'user_action': 'PAY_NOW',
                        'return_url': f"{request.host_url}success",
                        'cancel_url': f"{request.host_url}cancel"
                    }
                }
            }
        }
        
        response = requests.post(
            f'{PAYPAL_BASE_URL}/v2/checkout/orders',
            headers={
                'Content-Type': 'application/json',
                'Authorization': f'Bearer {access_token}',
                'PayPal-Request-Id': str(uuid.uuid4())
            },
            json=order_payload
        )
        
        return jsonify(response.json()), response.status_code
        
    except Exception as e:
        return jsonify({'error': 'ORDER_CREATION_FAILED'}), 500
```

