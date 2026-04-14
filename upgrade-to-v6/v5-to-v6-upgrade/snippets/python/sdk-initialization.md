# SDK Initialization (Server Support)

## Flask Implementation

```python
app = Flask(__name__, static_folder='static')

PAYPAL_CLIENT_ID = os.environ['PAYPAL_CLIENT_ID']
PAYPAL_CLIENT_SECRET = os.environ['PAYPAL_CLIENT_SECRET']
PAYPAL_ENVIRONMENT = os.environ.get('PAYPAL_ENVIRONMENT', 'sandbox')
PAYPAL_BASE_URL = 'https://api-m.paypal.com' if PAYPAL_ENVIRONMENT == 'live' else 'https://api-m.sandbox.paypal.com'

cached_token = None
token_expiration = None

@app.route('/paypal-api/auth/browser-safe-client-token', methods=['GET'])
def get_client_token():
    global cached_token, token_expiration
    
    try:
        if cached_token and token_expiration and datetime.now() < token_expiration:
            return jsonify({
                'accessToken': cached_token,
                'expiresIn': int((token_expiration - datetime.now()).total_seconds())
            })
        
        auth = base64.b64encode(f"{PAYPAL_CLIENT_ID}:{PAYPAL_CLIENT_SECRET}".encode()).decode()
        
        response = requests.post(
            f'{PAYPAL_BASE_URL}/v1/oauth2/token',
            headers={
                'Authorization': f'Basic {auth}',
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            data='grant_type=client_credentials&response_type=client_token&intent=sdk_init'
        )
        response.raise_for_status()
        
        token_data = response.json()
        access_token = token_data['access_token']
        expires_in = token_data.get('expires_in', 900)
        
        cached_token = access_token
        token_expiration = datetime.now() + timedelta(seconds=expires_in - 120)
        
        return jsonify({
            'accessToken': access_token,
            'expiresIn': expires_in
        })
        
    except Exception as e:
        return jsonify({'error': 'TOKEN_GENERATION_FAILED'}), 500

@app.route('/')
def serve_index():
    return send_from_directory(app.static_folder, 'index.html')

@app.route('/<path:path>')
def serve_static(path):
    return send_from_directory(app.static_folder, path)

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=3000, debug=True)
```

## HTML Template (static/index.html)

```html
<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>PayPal v6 Integration</title>
</head>
<body>
  <h1>PayPal v6 Checkout</h1>
  
  <div id="loading" class="loading">
    <p>Loading payment options...</p>
  </div>
  
  <div id="error" class="error" style="display:none;">
    <p id="error-message"></p>
  </div>
  
  <div class="buttons-container">
    <paypal-button 
      id="paypal-button" 
      type="pay" 
      class="paypal-gold" 
      hidden>
    </paypal-button>
  </div>
  
  <script src="app.js"></script>
  <script 
    async 
    src="https://www.sandbox.paypal.com/web-sdk/v6/core" 
    onload="onPayPalWebSdkLoaded()">
  </script>
</body>
</html>
```

## Environment Variables

```bash
PAYPAL_CLIENT_ID=your_client_id_here
PAYPAL_CLIENT_SECRET=your_client_secret_here
PAYPAL_ENVIRONMENT=sandbox
PORT=3000
```

