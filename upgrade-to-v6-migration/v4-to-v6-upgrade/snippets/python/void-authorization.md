#### Void Authorization

```python
@app.route('/paypal-api/payments/authorizations/<authorization_id>/void', methods=['POST'])
def void_authorization(authorization_id):
    """Void (cancel) an authorization"""
    try:
        access_token = get_access_token()
        
        headers = {
            'Content-Type': 'application/json',
            'Authorization': f'Bearer {access_token}',
            'PayPal-Request-Id': str(uuid.uuid4())
        }
        
        response = requests.post(
            f'{PAYPAL_BASE}/v2/payments/authorizations/{authorization_id}/void',
            headers=headers,
            json={}
        )
        
        response.raise_for_status()
        return jsonify({
            'success': True,
            'authorizationId': authorization_id,
            'status': 'VOIDED'
        })
        
    except requests.exceptions.RequestException as e:
        error_data = e.response.json() if e.response else {}
        return jsonify({'error': 'VOID_FAILED', 'details': error_data}), 500
```

