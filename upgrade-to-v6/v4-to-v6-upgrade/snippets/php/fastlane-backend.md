#### Fastlane - Create Order with Single-Use Token

```php
<?php

function createFastlaneOrder() {
    try {
        $body = json_decode(file_get_contents('php://input'), true);
        $accessToken = getAccessToken();
        $paypalBase = getenv('PAYPAL_BASE') ?: 'https://api-m.sandbox.paypal.com';
        
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
?>
```

#### CORS Configuration

```php
<?php

header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization, PayPal-Request-Id');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}
?>
```

