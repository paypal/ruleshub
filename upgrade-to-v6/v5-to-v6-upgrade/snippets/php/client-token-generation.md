# Client Token Generation (Server-Side)

## PHP Implementation

```php
<?php

$clientId = getenv('PAYPAL_CLIENT_ID');
$clientSecret = getenv('PAYPAL_CLIENT_SECRET');
$paypalBase = getenv('PAYPAL_BASE_URL') ?: 'https://api-m.sandbox.paypal.com';

$cachedToken = null;
$tokenExpiration = null;

function getAccessToken() {
    global $clientId, $clientSecret, $paypalBase;
    
    $auth = base64_encode($clientId . ':' . $clientSecret);
    
    $ch = curl_init($paypalBase . '/v1/oauth2/token');
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_POST, true);
    curl_setopt($ch, CURLOPT_HTTPHEADER, [
        'Authorization: Basic ' . $auth,
        'Content-Type: application/x-www-form-urlencoded'
    ]);
    curl_setopt($ch, CURLOPT_POSTFIELDS, 'grant_type=client_credentials');
    
    $response = curl_exec($ch);
    curl_close($ch);
    
    $data = json_decode($response, true);
    return $data['access_token'];
}

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
        curl_setopt($ch, CURLOPT_HEADER, true);
        
        $response = curl_exec($ch);
        $headerSize = curl_getinfo($ch, CURLINFO_HEADER_SIZE);
        $body = substr($response, $headerSize);
        curl_close($ch);
        
        $data = json_decode($body, true);
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
        echo json_encode([
            'error' => 'TOKEN_GENERATION_FAILED',
            'message' => 'Failed to generate client token'
        ]);
    }
    exit;
}
```

## Environment Variables (.env)

```bash
PAYPAL_CLIENT_ID=your_client_id_here
PAYPAL_CLIENT_SECRET=your_client_secret_here
PAYPAL_BASE_URL=https://api-m.sandbox.paypal.com
```

