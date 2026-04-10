# Use Saved Payment (Server-Side)

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

if ($_SERVER['REQUEST_METHOD'] === 'GET' && $_SERVER['REQUEST_URI'] === '/paypal-api/customer/payment-methods') {
    header('Content-Type: application/json');
    
    try {
        $customerId = $_GET['customer_id'] ?? null;
        
        if (empty($customerId)) {
            http_response_code(400);
            echo json_encode([
                'error' => 'MISSING_CUSTOMER_ID',
                'message' => 'customer_id is required'
            ]);
            exit;
        }
        
        $accessToken = getAccessToken();
        
        $ch = curl_init($paypalBase . '/v3/vault/payment-tokens?customer_id=' . urlencode($customerId));
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_HTTPHEADER, [
            'Authorization: Bearer ' . $accessToken,
            'Content-Type: application/json'
        ]);
        
        $response = curl_exec($ch);
        curl_close($ch);
        
        $tokensData = json_decode($response, true);
        $paymentTokens = $tokensData['payment_tokens'] ?? [];
        
        echo json_encode([
            'payment_tokens' => $paymentTokens,
            'total_items' => count($paymentTokens)
        ]);
        
    } catch (Exception $e) {
        http_response_code(500);
        echo json_encode(['error' => 'FETCH_FAILED']);
    }
    exit;
}

if ($_SERVER['REQUEST_METHOD'] === 'POST' && $_SERVER['REQUEST_URI'] === '/paypal-api/checkout/orders/create-with-saved-card') {
    header('Content-Type: application/json');
    
    try {
        $input = json_decode(file_get_contents('php://input'), true);
        $vaultId = $input['vaultId'] ?? null;
        
        if (empty($vaultId)) {
            http_response_code(400);
            echo json_encode([
                'error' => 'MISSING_VAULT_ID',
                'message' => 'vaultId is required'
            ]);
            exit;
        }
        
        $accessToken = getAccessToken();
        $amount = $input['amount'];
        $currency = $input['currency'] ?? 'USD';
        
        $orderPayload = [
            'intent' => 'CAPTURE',
            'purchase_units' => [[
                'amount' => [
                    'currency_code' => $currency,
                    'value' => number_format(floatval($amount), 2, '.', '')
                ]
            ]],
            'payment_source' => [
                'card' => [
                    'vault_id' => $vaultId
                ]
            ]
        ];
        
        $ch = curl_init($paypalBase . '/v2/checkout/orders');
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_POST, true);
        curl_setopt($ch, CURLOPT_HTTPHEADER, [
            'Content-Type: application/json',
            'Authorization: Bearer ' . $accessToken,
            'PayPal-Request-Id: ' . uniqid()
        ]);
        curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($orderPayload));
        
        $response = curl_exec($ch);
        curl_close($ch);
        
        $orderData = json_decode($response, true);
        
        if ($orderData['status'] === 'CREATED') {
            $orderId = $orderData['id'];
            
            $ch = curl_init($paypalBase . '/v2/checkout/orders/' . $orderId . '/capture');
            curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
            curl_setopt($ch, CURLOPT_POST, true);
            curl_setopt($ch, CURLOPT_HTTPHEADER, [
                'Content-Type: application/json',
                'Authorization: Bearer ' . $accessToken,
                'PayPal-Request-Id: ' . uniqid()
            ]);
            curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode([]));
            
            $captureResponse = curl_exec($ch);
            curl_close($ch);
            
            echo $captureResponse;
            exit;
        }
        
        echo $response;
        
    } catch (Exception $e) {
        http_response_code(500);
        echo json_encode(['error' => 'PAYMENT_FAILED']);
    }
    exit;
}

if ($_SERVER['REQUEST_METHOD'] === 'POST' && $_SERVER['REQUEST_URI'] === '/paypal-api/checkout/orders/create-with-saved-paypal') {
    header('Content-Type: application/json');
    
    try {
        $input = json_decode(file_get_contents('php://input'), true);
        $paymentTokenId = $input['paymentTokenId'] ?? null;
        
        if (empty($paymentTokenId)) {
            http_response_code(400);
            echo json_encode([
                'error' => 'MISSING_PAYMENT_TOKEN',
                'message' => 'paymentTokenId is required'
            ]);
            exit;
        }
        
        $accessToken = getAccessToken();
        $amount = $input['amount'];
        $currency = $input['currency'] ?? 'USD';
        
        $orderPayload = [
            'intent' => 'CAPTURE',
            'purchase_units' => [[
                'amount' => [
                    'currency_code' => $currency,
                    'value' => number_format(floatval($amount), 2, '.', '')
                ]
            ]],
            'payment_source' => [
                'paypal' => [
                    'vault_id' => $paymentTokenId
                ]
            ]
        ];
        
        $ch = curl_init($paypalBase . '/v2/checkout/orders');
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_POST, true);
        curl_setopt($ch, CURLOPT_HTTPHEADER, [
            'Content-Type: application/json',
            'Authorization: Bearer ' . $accessToken,
            'PayPal-Request-Id: ' . uniqid()
        ]);
        curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($orderPayload));
        
        $response = curl_exec($ch);
        curl_close($ch);
        
        $orderData = json_decode($response, true);
        
        if ($orderData['status'] === 'CREATED') {
            $orderId = $orderData['id'];
            
            $ch = curl_init($paypalBase . '/v2/checkout/orders/' . $orderId . '/capture');
            curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
            curl_setopt($ch, CURLOPT_POST, true);
            curl_setopt($ch, CURLOPT_HTTPHEADER, [
                'Content-Type: application/json',
                'Authorization: Bearer ' . $accessToken,
                'PayPal-Request-Id: ' . uniqid()
            ]);
            curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode([]));
            
            $captureResponse = curl_exec($ch);
            curl_close($ch);
            
            echo $captureResponse;
            exit;
        }
        
        echo $response;
        
    } catch (Exception $e) {
        http_response_code(500);
        echo json_encode(['error' => 'PAYMENT_FAILED']);
    }
    exit;
}
```

