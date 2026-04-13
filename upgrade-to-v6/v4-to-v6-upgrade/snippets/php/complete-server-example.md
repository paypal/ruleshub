#### Complete PHP Server for v6 SDK

```php
<?php

header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization, PayPal-Request-Id');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

$paypalBase = getenv('PAYPAL_BASE') ?: 'https://api-m.sandbox.paypal.com';
$clientId = getenv('PAYPAL_CLIENT_ID');
$clientSecret = getenv('PAYPAL_CLIENT_SECRET');

function getAccessToken() {
    global $clientId, $clientSecret, $paypalBase;
    
    $ch = curl_init();
    curl_setopt($ch, CURLOPT_URL, "$paypalBase/v1/oauth2/token");
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_POST, true);
    curl_setopt($ch, CURLOPT_USERPWD, "$clientId:$clientSecret");
    curl_setopt($ch, CURLOPT_POSTFIELDS, 'grant_type=client_credentials');
    curl_setopt($ch, CURLOPT_HTTPHEADER, [
        'Content-Type: application/x-www-form-urlencoded'
    ]);
    
    $response = curl_exec($ch);
    curl_close($ch);
    
    $data = json_decode($response, true);
    return $data['access_token'];
}

$requestUri = $_SERVER['REQUEST_URI'];
$requestMethod = $_SERVER['REQUEST_METHOD'];

if ($requestUri === '/paypal-api/auth/browser-safe-client-token' && $requestMethod === 'GET') {
    try {
        $ch = curl_init();
        curl_setopt($ch, CURLOPT_URL, "$paypalBase/v1/oauth2/token");
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_POST, true);
        curl_setopt($ch, CURLOPT_USERPWD, "$clientId:$clientSecret");
        curl_setopt($ch, CURLOPT_POSTFIELDS, 'grant_type=client_credentials&response_type=client_token&intent=sdk_init');
        curl_setopt($ch, CURLOPT_HTTPHEADER, [
            'Content-Type: application/x-www-form-urlencoded'
        ]);
        
        $response = curl_exec($ch);
        curl_close($ch);
        
        $tokenData = json_decode($response, true);
        header('Content-Type: application/json');
        echo json_encode(['accessToken' => $tokenData['access_token']]);
        
    } catch (Exception $e) {
        http_response_code(500);
        echo json_encode(['error' => 'TOKEN_GENERATION_FAILED']);
    }
}

elseif ($requestUri === '/paypal-api/checkout/orders/create' && $requestMethod === 'POST') {
    try {
        $body = json_decode(file_get_contents('php://input'), true);
        $accessToken = getAccessToken();
        
        $paypalRequestId = $_SERVER['HTTP_PAYPAL_REQUEST_ID'] ?? uniqid();
        
        $ch = curl_init();
        curl_setopt($ch, CURLOPT_URL, "$paypalBase/v2/checkout/orders");
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_POST, true);
        curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($body));
        curl_setopt($ch, CURLOPT_HTTPHEADER, [
            'Content-Type: application/json',
            "Authorization: Bearer $accessToken",
            "PayPal-Request-Id: $paypalRequestId"
        ]);
        
        $response = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);
        
        http_response_code($httpCode);
        header('Content-Type: application/json');
        echo $response;
        
    } catch (Exception $e) {
        http_response_code(500);
        echo json_encode(['error' => 'ORDER_CREATION_FAILED']);
    }
}

elseif (preg_match('#^/paypal-api/checkout/orders/([^/]+)/capture$#', $requestUri, $matches) && $requestMethod === 'POST') {
    try {
        $orderId = $matches[1];
        $accessToken = getAccessToken();
        
        $ch = curl_init();
        curl_setopt($ch, CURLOPT_URL, "$paypalBase/v2/checkout/orders/$orderId/capture");
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_POST, true);
        curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode([]));
        curl_setopt($ch, CURLOPT_HTTPHEADER, [
            'Content-Type: application/json',
            "Authorization: Bearer $accessToken",
            'PayPal-Request-Id: ' . uniqid()
        ]);
        
        $response = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);
        
        http_response_code($httpCode);
        header('Content-Type: application/json');
        echo $response;
        
    } catch (Exception $e) {
        http_response_code(500);
        echo json_encode(['error' => 'CAPTURE_FAILED']);
    }
}

else {
    http_response_code(404);
    echo json_encode(['error' => 'Not found']);
}
?>
```

#### Environment Variables (.env)

```bash
PAYPAL_CLIENT_ID=your_client_id_here
PAYPAL_CLIENT_SECRET=your_client_secret_here
PAYPAL_BASE=https://api-m.sandbox.paypal.com
```

