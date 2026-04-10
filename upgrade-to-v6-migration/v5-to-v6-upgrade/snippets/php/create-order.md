# Create Order (Server-Side)

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

if ($_SERVER['REQUEST_METHOD'] === 'POST' && $_SERVER['REQUEST_URI'] === '/paypal-api/checkout/orders/create') {
    header('Content-Type: application/json');
    
    try {
        $input = json_decode(file_get_contents('php://input'), true);
        
        $amount = $input['amount'] ?? null;
        $currency = $input['currency'] ?? 'USD';
        
        if (!$amount || floatval($amount) <= 0) {
            http_response_code(400);
            echo json_encode([
                'error' => 'INVALID_AMOUNT',
                'message' => 'Invalid or missing amount'
            ]);
            exit;
        }
        
        $accessToken = getAccessToken();
        
        $orderPayload = [
            'intent' => 'CAPTURE',
            'purchase_units' => [[
                'amount' => [
                    'currency_code' => $currency,
                    'value' => number_format(floatval($amount), 2, '.', '')
                ]
            ]]
        ];
        
        if (isset($input['description'])) {
            $orderPayload['purchase_units'][0]['description'] = $input['description'];
        }
        
        if (isset($input['custom_id'])) {
            $orderPayload['purchase_units'][0]['custom_id'] = $input['custom_id'];
        }
        
        if (isset($input['invoice_id'])) {
            $orderPayload['purchase_units'][0]['invoice_id'] = $input['invoice_id'];
        }
        
        $orderPayload['payment_source'] = [
            'paypal' => [
                'experience_context' => [
                    'payment_method_preference' => 'IMMEDIATE_PAYMENT_REQUIRED',
                    'brand_name' => 'Your Store Name',
                    'locale' => 'en-US',
                    'landing_page' => 'LOGIN',
                    'shipping_preference' => 'NO_SHIPPING',
                    'user_action' => 'PAY_NOW',
                    'return_url' => 'https://example.com/success',
                    'cancel_url' => 'https://example.com/cancel'
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
        
        $orderData = json_decode($response, true);
        
        http_response_code($httpCode);
        echo json_encode([
            'id' => $orderData['id'],
            'status' => $orderData['status'],
            'links' => $orderData['links'] ?? []
        ]);
        
    } catch (Exception $e) {
        http_response_code(500);
        echo json_encode([
            'error' => 'ORDER_CREATION_FAILED',
            'message' => 'Failed to create order'
        ]);
    }
    exit;
}
```

