# Card Fields Integration (Server-Side)

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

@app.route('/paypal-api/checkout/orders/create-card-fields', methods=['POST'])
def create_order_for_card_fields():
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
                'card': {
                    'attributes': {
                        'verification': {
                            'method': data.get('verification_method', 'SCA_WHEN_REQUIRED')
                        }
                    },
                    'experience_context': {
                        'return_url': data.get('return_url', f"{request.host_url}returnUrl"),
                        'cancel_url': data.get('cancel_url', f"{request.host_url}cancelUrl")
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

@app.route('/paypal-api/checkout/orders/confirm-payment-source', methods=['POST'])
def confirm_payment_source():
    try:
        data = request.get_json()
        access_token = get_access_token()
        
        order_id = data.get('orderId')
        
        if not order_id:
            return jsonify({
                'error': 'MISSING_ORDER_ID',
                'message': 'orderId is required'
            }), 400
        
        confirm_payload = {
            'payment_source': {
                'card': {
                    'single_use_token': data.get('single_use_token')
                }
            }
        }
        
        response = requests.post(
            f'{PAYPAL_BASE_URL}/v2/checkout/orders/{order_id}/confirm-payment-source',
            headers={
                'Content-Type': 'application/json',
                'Authorization': f'Bearer {access_token}',
                'PayPal-Request-Id': str(uuid.uuid4())
            },
            json=confirm_payload
        )
        
        return jsonify(response.json()), response.status_code
        
    except Exception as e:
        return jsonify({'error': 'CONFIRMATION_FAILED'}), 500
```

