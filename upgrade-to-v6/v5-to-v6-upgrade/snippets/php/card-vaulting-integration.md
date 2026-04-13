# Card Vaulting Integration (Server-Side)

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

if ($_SERVER['REQUEST_METHOD'] === 'POST' && $_SERVER['REQUEST_URI'] === '/paypal-api/checkout/orders/create-with-vault') {
    header('Content-Type: application/json');
    
    try {
        $input = json_decode(file_get_contents('php://input'), true);
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
            ]]
        ];
        
        if ($input['saveCard'] ?? false) {
            $orderPayload['payment_source'] = [
                'card' => [
                    'attributes' => [
                        'verification' => [
                            'method' => 'SCA_WHEN_REQUIRED'
                        ],
                        'vault' => [
                            'store_in_vault' => 'ON_SUCCESS',
                            'usage_type' => 'MERCHANT',
                            'customer_type' => 'CONSUMER',
                            'permit_multiple_payment_tokens' => true
                        ]
                    ]
                ]
            ];
        }
        
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
        
        echo $response;
        
    } catch (Exception $e) {
        http_response_code(500);
        echo json_encode(['error' => 'ORDER_CREATION_FAILED']);
    }
    exit;
}

if ($_SERVER['REQUEST_METHOD'] === 'POST' && $_SERVER['REQUEST_URI'] === '/paypal-api/checkout/orders/create-with-vault-id') {
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
        
    } catch (Exception $e) {
        http_response_code(500);
        echo json_encode(['error' => 'PAYMENT_FAILED']);
    }
    exit;
}
```

