# Card Fields Integration (Server-Side)

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

if ($_SERVER['REQUEST_METHOD'] === 'POST' && $_SERVER['REQUEST_URI'] === '/paypal-api/checkout/orders/create-card-fields') {
    header('Content-Type: application/json');
    
    try {
        $input = json_decode(file_get_contents('php://input'), true);
        $accessToken = getAccessToken();
        
        $amount = $input['amount'];
        $currency = $input['currency'] ?? 'USD';
        $verificationMethod = $input['verification_method'] ?? 'SCA_WHEN_REQUIRED';
        
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
                    'attributes' => [
                        'verification' => [
                            'method' => $verificationMethod
                        ]
                    ],
                    'experience_context' => [
                        'return_url' => $input['return_url'] ?? 'https://example.com/returnUrl',
                        'cancel_url' => $input['cancel_url'] ?? 'https://example.com/cancelUrl'
                    ]
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
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);
        
        http_response_code($httpCode);
        echo $response;
        
    } catch (Exception $e) {
        http_response_code(500);
        echo json_encode(['error' => 'ORDER_CREATION_FAILED']);
    }
    exit;
}

if ($_SERVER['REQUEST_METHOD'] === 'POST' && $_SERVER['REQUEST_URI'] === '/paypal-api/checkout/orders/confirm-payment-source') {
    header('Content-Type: application/json');
    
    try {
        $input = json_decode(file_get_contents('php://input'), true);
        $orderId = $input['orderId'] ?? null;
        
        if (empty($orderId)) {
            http_response_code(400);
            echo json_encode([
                'error' => 'MISSING_ORDER_ID',
                'message' => 'orderId is required'
            ]);
            exit;
        }
        
        $accessToken = getAccessToken();
        
        $payload = [
            'payment_source' => [
                'card' => [
                    'single_use_token' => $input['single_use_token']
                ]
            ]
        ];
        
        $ch = curl_init($paypalBase . '/v2/checkout/orders/' . $orderId . '/confirm-payment-source');
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_POST, true);
        curl_setopt($ch, CURLOPT_HTTPHEADER, [
            'Content-Type: application/json',
            'Authorization: Bearer ' . $accessToken,
            'PayPal-Request-Id: ' . uniqid()
        ]);
        curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($payload));
        
        $response = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);
        
        http_response_code($httpCode);
        echo $response;
        
    } catch (Exception $e) {
        http_response_code(500);
        echo json_encode(['error' => 'CONFIRMATION_FAILED']);
    }
    exit;
}
```

