# Get Order Details (Server-Side)

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

if ($_SERVER['REQUEST_METHOD'] === 'GET' && preg_match('/^\/paypal-api\/checkout\/orders\/([^\/]+)$/', $_SERVER['REQUEST_URI'], $matches)) {
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
            'Authorization: Bearer ' . $accessToken,
            'Content-Type: application/json'
        ]);
        
        $response = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);
        
        if ($httpCode === 404) {
            http_response_code(404);
            echo json_encode([
                'error' => 'ORDER_NOT_FOUND',
                'message' => 'Order not found'
            ]);
            exit;
        }
        
        if ($httpCode !== 200) {
            http_response_code($httpCode);
            echo json_encode([
                'error' => 'FETCH_FAILED',
                'message' => 'Failed to fetch order'
            ]);
            exit;
        }
        
        echo $response;
        
    } catch (Exception $e) {
        http_response_code(500);
        echo json_encode([
            'error' => 'FETCH_FAILED',
            'message' => 'Failed to fetch order details'
        ]);
    }
    exit;
}

if ($_SERVER['REQUEST_METHOD'] === 'GET' && preg_match('/^\/paypal-api\/checkout\/orders\/([^\/]+)\/summary$/', $_SERVER['REQUEST_URI'], $matches)) {
    header('Content-Type: application/json');
    
    try {
        $orderId = $matches[1];
        $accessToken = getAccessToken();
        
        $ch = curl_init($paypalBase . '/v2/checkout/orders/' . $orderId);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_HTTPHEADER, [
            'Authorization: Bearer ' . $accessToken
        ]);
        
        $response = curl_exec($ch);
        curl_close($ch);
        
        $orderData = json_decode($response, true);
        
        $captures = $orderData['purchase_units'][0]['payments']['captures'] ?? [];
        $authorizations = $orderData['purchase_units'][0]['payments']['authorizations'] ?? [];
        
        $summary = [
            'id' => $orderData['id'],
            'status' => $orderData['status'],
            'amount' => $orderData['purchase_units'][0]['amount'],
            'payer' => $orderData['payer'] ?? null,
            'captureId' => !empty($captures) ? $captures[0]['id'] : null,
            'authorizationId' => !empty($authorizations) ? $authorizations[0]['id'] : null,
            'create_time' => $orderData['create_time'] ?? null,
            'update_time' => $orderData['update_time'] ?? null
        ];
        
        echo json_encode($summary);
        
    } catch (Exception $e) {
        http_response_code(500);
        echo json_encode(['error' => 'FETCH_FAILED']);
    }
    exit;
}
```

