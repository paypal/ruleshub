# Save Payment Button (Server-Side)

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

if ($_SERVER['REQUEST_METHOD'] === 'POST' && $_SERVER['REQUEST_URI'] === '/paypal-api/vault/setup-tokens/create') {
    header('Content-Type: application/json');
    
    try {
        $input = json_decode(file_get_contents('php://input'), true);
        $accessToken = getAccessToken();
        
        $paymentMethod = $input['payment_method'] ?? 'paypal';
        $payload = [];
        
        if ($paymentMethod === 'paypal') {
            $payload = [
                'payment_source' => [
                    'paypal' => [
                        'usage_type' => 'MERCHANT',
                        'customer_type' => 'CONSUMER',
                        'permit_multiple_payment_tokens' => true
                    ]
                ]
            ];
        } elseif ($paymentMethod === 'card') {
            $payload = [
                'payment_source' => [
                    'card' => [
                        'experience_context' => [
                            'return_url' => $input['return_url'] ?? 'https://example.com/returnUrl',
                            'cancel_url' => $input['cancel_url'] ?? 'https://example.com/cancelUrl'
                        ],
                        'verification_method' => 'SCA_WHEN_REQUIRED'
                    ]
                ]
            ];
        } else {
            http_response_code(400);
            echo json_encode([
                'error' => 'INVALID_PAYMENT_METHOD',
                'message' => 'Payment method must be paypal or card'
            ]);
            exit;
        }
        
        $ch = curl_init($paypalBase . '/v3/vault/setup-tokens');
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
        
        if ($httpCode !== 200 && $httpCode !== 201) {
            http_response_code($httpCode);
            echo $response;
            exit;
        }
        
        $setupData = json_decode($response, true);
        
        echo json_encode([
            'id' => $setupData['id'],
            'status' => $setupData['status']
        ]);
        
    } catch (Exception $e) {
        http_response_code(500);
        echo json_encode(['error' => 'SETUP_TOKEN_FAILED']);
    }
    exit;
}

if ($_SERVER['REQUEST_METHOD'] === 'POST' && $_SERVER['REQUEST_URI'] === '/paypal-api/vault/payment-tokens/create') {
    header('Content-Type: application/json');
    
    try {
        $input = json_decode(file_get_contents('php://input'), true);
        $setupToken = $input['vaultSetupToken'] ?? null;
        
        if (empty($setupToken)) {
            http_response_code(400);
            echo json_encode([
                'error' => 'MISSING_SETUP_TOKEN',
                'message' => 'vaultSetupToken is required'
            ]);
            exit;
        }
        
        $accessToken = getAccessToken();
        
        $payload = [
            'payment_source' => [
                'token' => [
                    'id' => $setupToken,
                    'type' => 'SETUP_TOKEN'
                ]
            ]
        ];
        
        $ch = curl_init($paypalBase . '/v3/vault/payment-tokens');
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
        
        if ($httpCode !== 200 && $httpCode !== 201) {
            http_response_code($httpCode);
            echo $response;
            exit;
        }
        
        $tokenData = json_decode($response, true);
        
        echo json_encode([
            'id' => $tokenData['id'],
            'customerId' => $tokenData['customer']['id'] ?? null,
            'status' => 'saved'
        ]);
        
    } catch (Exception $e) {
        http_response_code(500);
        echo json_encode(['error' => 'PAYMENT_TOKEN_FAILED']);
    }
    exit;
}
```

