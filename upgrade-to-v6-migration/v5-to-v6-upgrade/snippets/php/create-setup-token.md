# Create Setup Token (Server-Side)

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

if ($_SERVER['REQUEST_METHOD'] === 'POST' && $_SERVER['REQUEST_URI'] === '/paypal-api/vault/setup-tokens') {
    header('Content-Type: application/json');
    
    try {
        $input = json_decode(file_get_contents('php://input'), true);
        $accessToken = getAccessToken();
        
        $paymentMethod = $input['payment_method'] ?? 'paypal';
        $setupTokenPayload = [];
        
        if ($paymentMethod === 'paypal') {
            $setupTokenPayload = [
                'payment_source' => [
                    'paypal' => [
                        'usage_type' => $input['usage_type'] ?? 'MERCHANT',
                        'customer_type' => $input['customer_type'] ?? 'CONSUMER',
                        'permit_multiple_payment_tokens' => $input['permit_multiple_payment_tokens'] ?? true
                    ]
                ]
            ];
        } elseif ($paymentMethod === 'card') {
            $setupTokenPayload = [
                'payment_source' => [
                    'card' => [
                        'experience_context' => [
                            'return_url' => $input['return_url'] ?? 'https://example.com/returnUrl',
                            'cancel_url' => $input['cancel_url'] ?? 'https://example.com/cancelUrl'
                        ],
                        'verification_method' => $input['verification_method'] ?? 'SCA_WHEN_REQUIRED'
                    ]
                ]
            ];
        }
        
        $ch = curl_init($paypalBase . '/v3/vault/setup-tokens');
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_POST, true);
        curl_setopt($ch, CURLOPT_HTTPHEADER, [
            'Content-Type: application/json',
            'Authorization: Bearer ' . $accessToken,
            'PayPal-Request-Id: ' . uniqid()
        ]);
        curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($setupTokenPayload));
        
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
        echo json_encode([
            'error' => 'SETUP_TOKEN_FAILED',
            'message' => 'Failed to create setup token'
        ]);
    }
    exit;
}

if ($_SERVER['REQUEST_METHOD'] === 'GET' && preg_match('/^\/paypal-api\/vault\/setup-tokens\/([^\/]+)$/', $_SERVER['REQUEST_URI'], $matches)) {
    header('Content-Type: application/json');
    
    try {
        $tokenId = $matches[1];
        $accessToken = getAccessToken();
        
        $ch = curl_init($paypalBase . '/v3/vault/setup-tokens/' . $tokenId);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_HTTPHEADER, [
            'Authorization: Bearer ' . $accessToken,
            'Content-Type: application/json'
        ]);
        
        $response = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);
        
        if ($httpCode !== 200) {
            http_response_code(404);
            echo json_encode(['error' => 'SETUP_TOKEN_NOT_FOUND']);
            exit;
        }
        
        echo $response;
        
    } catch (Exception $e) {
        http_response_code(500);
        echo json_encode(['error' => 'FETCH_FAILED']);
    }
    exit;
}
```

