# Capture Order (Server-Side)

## PHP Implementation

```php
<?php

$clientId = getenv('PAYPAL_CLIENT_ID');
$clientSecret = getenv('PAYPAL_CLIENT_SECRET');
$paypalBase = getenv('PAYPAL_BASE_URL') ?: 'https://api-m.sandbox.paypal.com';

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

if ($_SERVER['REQUEST_METHOD'] === 'POST' && preg_match('/^\/paypal-api\/checkout\/orders\/([^\/]+)\/capture$/', $_SERVER['REQUEST_URI'], $matches)) {
    header('Content-Type: application/json');
    
    try {
        $orderId = $matches[1];
        
        if (empty($orderId)) {
            http_response_code(400);
            echo json_encode([
                'error' => 'INVALID_ORDER_ID',
                'message' => 'Order ID is required'
            ]);
            exit;
        }
        
        $accessToken = getAccessToken();
        
        $ch = curl_init($paypalBase . '/v2/checkout/orders/' . $orderId);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_HTTPHEADER, [
            'Authorization: Bearer ' . $accessToken
        ]);
        
        $response = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);
        
        if ($httpCode !== 200) {
            http_response_code(404);
            echo json_encode([
                'error' => 'ORDER_NOT_FOUND',
                'message' => 'Order not found'
            ]);
            exit;
        }
        
        $orderData = json_decode($response, true);
        
        if ($orderData['status'] !== 'APPROVED') {
            http_response_code(400);
            echo json_encode([
                'error' => 'ORDER_NOT_APPROVED',
                'message' => 'Order status is ' . $orderData['status'] . ', not APPROVED',
                'orderId' => $orderId
            ]);
            exit;
        }
        
        $ch = curl_init($paypalBase . '/v2/checkout/orders/' . $orderId . '/capture');
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_POST, true);
        curl_setopt($ch, CURLOPT_HTTPHEADER, [
            'Content-Type: application/json',
            'Authorization: Bearer ' . $accessToken,
            'PayPal-Request-Id: ' . uniqid()
        ]);
        curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode([]));
        
        $response = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);
        
        $captureData = json_decode($response, true);
        
        if ($httpCode === 422) {
            http_response_code(422);
            echo json_encode([
                'error' => 'ORDER_ALREADY_CAPTURED',
                'message' => 'Order cannot be captured'
            ]);
            exit;
        }
        
        if ($httpCode !== 201) {
            http_response_code($httpCode);
            echo json_encode([
                'error' => 'CAPTURE_FAILED',
                'message' => 'Failed to capture order'
            ]);
            exit;
        }
        
        $capture = $captureData['purchase_units'][0]['payments']['captures'][0];
        
        echo json_encode([
            'id' => $captureData['id'],
            'status' => $captureData['status'],
            'captureId' => $capture['id'],
            'amount' => $capture['amount'],
            'payer' => $captureData['payer'] ?? null,
            'create_time' => $capture['create_time']
        ]);
        
    } catch (Exception $e) {
        http_response_code(500);
        echo json_encode([
            'error' => 'CAPTURE_FAILED',
            'message' => 'Failed to capture order'
        ]);
    }
    exit;
}
```

