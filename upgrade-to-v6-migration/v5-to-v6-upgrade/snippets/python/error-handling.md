# Error Handling (Server-Side)

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

def get_user_friendly_error_message(error_code):
    error_messages = {
        'INVALID_CLIENT_TOKEN': 'Payment session expired. Please refresh the page and try again.',
        'CLIENT_TOKEN_EXPIRED': 'Payment session expired. Please refresh and try again.',
        'AUTHORIZATION_FAILED': 'Payment authorization failed. Please verify your PayPal account and try again.',
        'NETWORK_ERROR': 'Network connection issue. Please check your internet connection and try again.',
        'TIMEOUT_ERROR': 'Request timed out. Please try again.',
        'SERVER_ERROR': 'Our payment service is temporarily unavailable. Please try again in a few moments.',
        'PAYMENT_CANCELLED': 'Payment was cancelled. Your items are still in your cart.',
        'PAYMENT_DECLINED': 'Payment was declined. Please try a different payment method.',
        'INSUFFICIENT_FUNDS': 'Insufficient funds. Please choose a different payment method.',
        'ORDER_NOT_FOUND': 'Order not found. Please start checkout again.',
        'ORDER_NOT_APPROVED': 'Order was not approved. Please complete the payment.',
        'ORDER_ALREADY_CAPTURED': 'This order has already been processed.',
        'INSTRUMENT_DECLINED': 'Payment method was declined. Please try another payment method.',
        'VALIDATION_ERROR': 'Invalid request data. Please check your information and try again.'
    }
    
    return error_messages.get(error_code, 'An error occurred. Please try again or contact support.')

def log_paypal_error(operation, debug_id, status_code, error_data, request_data=None):
    print('PayPal API Error:')
    print(f'  Operation: {operation}')
    print(f'  Debug ID: {debug_id}')
    print(f'  Status Code: {status_code}')
    print(f'  Error Name: {error_data.get("name")}')
    print(f'  Error Message: {error_data.get("message")}')
    print(f'  Error Details: {error_data.get("details")}')
    if request_data:
        print(f'  Request Data: {request_data}')
    print(f'  Timestamp: {datetime.now().isoformat()}')
    
    return debug_id

def handle_validation_error(error_data, debug_id):
    field_errors = [
        {
            'field': detail.get('field'),
            'issue': detail.get('issue'),
            'description': detail.get('description')
        }
        for detail in error_data.get('details', [])
    ]
    
    return {
        'error': 'VALIDATION_ERROR',
        'debugId': debug_id,
        'message': 'Invalid request data',
        'fieldErrors': field_errors
    }

def handle_authentication_error(debug_id):
    return {
        'error': 'AUTHENTICATION_FAILED',
        'debugId': debug_id,
        'message': 'Invalid or expired credentials'
    }

def handle_payment_error(error_data, debug_id):
    error_name = error_data.get('name', '')
    
    if 'INSTRUMENT_DECLINED' in error_name:
        user_message = 'Payment method was declined. Please try another payment method.'
    elif 'INSUFFICIENT_FUNDS' in error_name:
        user_message = 'Insufficient funds. Please try another payment method.'
    elif 'ORDER_NOT_APPROVED' in error_name:
        user_message = 'Order was not approved. Please try again.'
    else:
        user_message = 'Payment could not be processed'
    
    return {
        'error': error_name,
        'debugId': debug_id,
        'message': user_message,
        'details': error_data.get('details', [])
    }

@app.route('/paypal-api/checkout/orders/create-with-error-handling', methods=['POST'])
def create_order_with_error_handling():
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
            }]
        }
        
        response = requests.post(
            f'{PAYPAL_BASE_URL}/v2/checkout/orders',
            headers={
                'Content-Type': 'application/json',
                'Authorization': f'Bearer {access_token}'
            },
            json=order_payload
        )
        
        if response.ok:
            return jsonify(response.json())
        
        debug_id = response.headers.get('PayPal-Debug-Id', 'N/A')
        error_data = response.json()
        
        log_paypal_error('create_order', debug_id, response.status_code, error_data, data)
        
        if response.status_code == 400:
            return jsonify(handle_validation_error(error_data, debug_id)), 400
        elif response.status_code == 401:
            return jsonify(handle_authentication_error(debug_id)), 401
        elif response.status_code == 422:
            return jsonify(handle_payment_error(error_data, debug_id)), 422
        
        return jsonify({
            'error': 'ORDER_CREATION_FAILED',
            'debugId': debug_id,
            'status': response.status_code,
            'details': error_data.get('details', []),
            'message': error_data.get('message', 'Failed to create order')
        }), response.status_code
        
    except requests.exceptions.RequestException as e:
        print(f'Unexpected error: {e}')
        return jsonify({
            'error': 'INTERNAL_ERROR',
            'message': 'An unexpected error occurred'
        }), 500

@app.errorhandler(400)
def bad_request(e):
    return jsonify({
        'error': 'BAD_REQUEST',
        'message': 'Invalid request data'
    }), 400

@app.errorhandler(404)
def not_found(e):
    return jsonify({
        'error': 'NOT_FOUND',
        'message': 'Resource not found'
    }), 404

@app.errorhandler(500)
def internal_error(e):
    return jsonify({
        'error': 'INTERNAL_SERVER_ERROR',
        'message': 'An internal error occurred. Please try again later.'
    }), 500
```

