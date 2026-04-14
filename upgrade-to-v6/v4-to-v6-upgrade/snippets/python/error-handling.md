#### Enhanced Error Handling with Debug IDs

```python
@app.route('/paypal-api/checkout/orders/create', methods=['POST'])
def create_order_with_error_handling():
    """Create order with comprehensive error handling"""
    try:
        body = request.get_json()
        access_token = get_access_token()
        
        headers = {
            'Content-Type': 'application/json',
            'Authorization': f'Bearer {access_token}',
            'PayPal-Request-Id': str(uuid.uuid4())
        }
        
        order_payload = {
            'intent': 'CAPTURE',
            'purchase_units': [{
                'amount': {
                    'currency_code': body.get('currency', 'USD'),
                    'value': body['amount']
                }
            }]
        }
        
        response = requests.post(
            f'{PAYPAL_BASE}/v2/checkout/orders',
            headers=headers,
            json=order_payload
        )
        
        # Handle response
        if response.ok:
            return jsonify(response.json())
        
        debug_id = response.headers.get('PayPal-Debug-Id', 'N/A')
        error_data = response.json() if response.content else {}
        
        print(f"Order creation failed - Debug ID: {debug_id}")
        print(f"Status: {response.status_code}")
        print(f"Error: {error_data}")
        
        return jsonify({
            'error': 'ORDER_CREATION_FAILED',
            'debugId': debug_id,
            'status': response.status_code,
            'details': error_data.get('details', []),
            'message': error_data.get('message', 'Failed to create order')
        }), response.status_code
        
    except requests.exceptions.RequestException as e:
        debug_id = e.response.headers.get('PayPal-Debug-Id') if e.response else None
        
        print(f"Request exception - Debug ID: {debug_id}")
        print(f"Error: {str(e)}")
        
        return jsonify({
            'error': 'REQUEST_FAILED',
            'debugId': debug_id,
            'message': 'Unable to process request'
        }), 500
    except Exception as e:
        print(f"Unexpected error: {str(e)}")
        return jsonify({
            'error': 'INTERNAL_ERROR',
            'message': 'An unexpected error occurred'
        }), 500
```

#### Error Handler Middleware

```python
from functools import wraps

def handle_paypal_errors(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        try:
            return f(*args, **kwargs)
        except requests.exceptions.HTTPError as e:
            debug_id = e.response.headers.get('PayPal-Debug-Id', 'N/A')
            error_data = e.response.json() if e.response.content else {}
            
            print(f"PayPal API Error - Debug ID: {debug_id}")
            print(f"Status: {e.response.status_code}")
            print(f"Details: {error_data}")
            
            return jsonify({
                'error': error_data.get('name', 'API_ERROR'),
                'debugId': debug_id,
                'message': error_data.get('message', 'PayPal API error'),
                'details': error_data.get('details', [])
            }), e.response.status_code
            
        except requests.exceptions.RequestException as e:
            print(f"Request Error: {str(e)}")
            return jsonify({
                'error': 'NETWORK_ERROR',
                'message': 'Failed to communicate with PayPal'
            }), 503
            
        except Exception as e:
            print(f"Unexpected Error: {str(e)}")
            return jsonify({
                'error': 'INTERNAL_ERROR',
                'message': 'An unexpected error occurred'
            }), 500
    
    return decorated_function

@app.route('/paypal-api/checkout/orders/create', methods=['POST'])
@handle_paypal_errors
def create_order():
    body = request.get_json()
    access_token = get_access_token()
    
    headers = {
        'Content-Type': 'application/json',
        'Authorization': f'Bearer {access_token}',
        'PayPal-Request-Id': str(uuid.uuid4())
    }
    
    response = requests.post(
        f'{PAYPAL_BASE}/v2/checkout/orders',
        headers=headers,
        json=body
    )
    
    response.raise_for_status()
    return jsonify(response.json())
```

#### Specific Error Handlers

```python
def handle_validation_error(error_response):
    """Handle validation errors with field-level details"""
    error_data = error_response.json()
    debug_id = error_response.headers.get('PayPal-Debug-Id', 'N/A')
    
    field_errors = []
    for detail in error_data.get('details', []):
        field_errors.append({
            'field': detail.get('field'),
            'issue': detail.get('issue'),
            'description': detail.get('description')
        })
    
    return {
        'error': 'VALIDATION_ERROR',
        'debugId': debug_id,
        'message': 'Invalid request data',
        'fieldErrors': field_errors
    }

def handle_authentication_error(error_response):
    """Handle authentication errors"""
    debug_id = error_response.headers.get('PayPal-Debug-Id', 'N/A')
    
    return {
        'error': 'AUTHENTICATION_FAILED',
        'debugId': debug_id,
        'message': 'Invalid or expired credentials'
    }

def handle_payment_error(error_response):
    """Handle payment-specific errors"""
    error_data = error_response.json()
    debug_id = error_response.headers.get('PayPal-Debug-Id', 'N/A')
    
    error_name = error_data.get('name', '')
    user_message = 'Payment could not be processed'
    
    if 'INSTRUMENT_DECLINED' in error_name:
        user_message = 'Payment method was declined. Please try another payment method.'
    elif 'INSUFFICIENT_FUNDS' in error_name:
        user_message = 'Insufficient funds. Please try another payment method.'
    elif 'ORDER_NOT_APPROVED' in error_name:
        user_message = 'Order was not approved. Please try again.'
    
    return {
        'error': error_name,
        'debugId': debug_id,
        'message': user_message,
        'details': error_data.get('details', [])
    }
```

#### Error Logger

```python
import logging

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger('paypal')

def log_paypal_error(operation, error_response, request_data=None):
    """Log PayPal errors with all relevant details"""
    debug_id = error_response.headers.get('PayPal-Debug-Id', 'N/A')
    error_data = error_response.json() if error_response.content else {}
    
    log_entry = {
        'operation': operation,
        'debug_id': debug_id,
        'status_code': error_response.status_code,
        'error_name': error_data.get('name'),
        'error_message': error_data.get('message'),
        'error_details': error_data.get('details', []),
        'request_data': request_data
    }
    
    logger.error(f"PayPal API Error: {log_entry}")
    
    return debug_id

@app.route('/paypal-api/checkout/orders/create', methods=['POST'])
def create_order_with_logging():
    try:
        body = request.get_json()
        access_token = get_access_token()
        
        headers = {
            'Content-Type': 'application/json',
            'Authorization': f'Bearer {access_token}',
            'PayPal-Request-Id': str(uuid.uuid4())
        }
        
        response = requests.post(
            f'{PAYPAL_BASE}/v2/checkout/orders',
            headers=headers,
            json=body
        )
        
        if not response.ok:
            debug_id = log_paypal_error('create_order', response, body)
            return jsonify({
                'error': 'ORDER_CREATION_FAILED',
                'debugId': debug_id,
                'message': 'Please contact support with this reference number'
            }), response.status_code
        
        return jsonify(response.json())
        
    except Exception as e:
        logger.exception(f"Unexpected error creating order: {str(e)}")
        return jsonify({'error': 'INTERNAL_ERROR'}), 500
```

