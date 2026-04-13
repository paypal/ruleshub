#### Capture Order

```php
<?php

function captureOrder($orderId) {
    try {
        $accessToken = getAccessToken();
        $paypalBase = getenv('PAYPAL_BASE') ?: 'https://api-m.sandbox.paypal.com';
        
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
?>
```

