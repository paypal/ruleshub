# SDK Initialization (Server Support)

## PHP Implementation

```php
<?php

header('Access-Control-Allow-Origin: *');

$clientId = getenv('PAYPAL_CLIENT_ID');
$clientSecret = getenv('PAYPAL_CLIENT_SECRET');
$paypalBase = getenv('PAYPAL_BASE_URL') ?: 'https://api-m.sandbox.paypal.com';

$cachedToken = null;
$tokenExpiration = null;

if ($_SERVER['REQUEST_METHOD'] === 'GET' && $_SERVER['REQUEST_URI'] === '/paypal-api/auth/browser-safe-client-token') {
    header('Content-Type: application/json');
    
    try {
        if ($cachedToken && $tokenExpiration && time() < $tokenExpiration) {
            echo json_encode([
                'accessToken' => $cachedToken,
                'expiresIn' => $tokenExpiration - time()
            ]);
            exit;
        }
        
        $auth = base64_encode($clientId . ':' . $clientSecret);
        
        $ch = curl_init($paypalBase . '/v1/oauth2/token');
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_POST, true);
        curl_setopt($ch, CURLOPT_HTTPHEADER, [
            'Authorization: Basic ' . $auth,
            'Content-Type: application/x-www-form-urlencoded'
        ]);
        curl_setopt($ch, CURLOPT_POSTFIELDS, 'grant_type=client_credentials&response_type=client_token&intent=sdk_init');
        
        $response = curl_exec($ch);
        curl_close($ch);
        
        $data = json_decode($response, true);
        $accessToken = $data['access_token'];
        $expiresIn = $data['expires_in'] ?? 900;
        
        $cachedToken = $accessToken;
        $tokenExpiration = time() + $expiresIn - 120;
        
        echo json_encode([
            'accessToken' => $accessToken,
            'expiresIn' => $expiresIn
        ]);
        
    } catch (Exception $e) {
        http_response_code(500);
        echo json_encode(['error' => 'TOKEN_GENERATION_FAILED']);
    }
    exit;
}

if ($_SERVER['REQUEST_METHOD'] === 'GET' && $_SERVER['REQUEST_URI'] === '/') {
    echo file_get_contents('index.html');
    exit;
}
```

## HTML Template (index.html)

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

## Environment Variables (.env)

```bash
PAYPAL_CLIENT_ID=your_client_id_here
PAYPAL_CLIENT_SECRET=your_client_secret_here
PAYPAL_BASE_URL=https://api-m.sandbox.paypal.com
```

