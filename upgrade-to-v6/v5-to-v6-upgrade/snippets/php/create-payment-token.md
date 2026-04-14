# Create Payment Token (Server-Side)

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

if ($_SERVER['REQUEST_METHOD'] === 'POST' && $_SERVER['REQUEST_URI'] === '/paypal-api/vault/payment-tokens') {
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
        echo json_encode([
            'error' => 'PAYMENT_TOKEN_FAILED',
            'message' => 'Failed to create payment token'
        ]);
    }
    exit;
}

if ($_SERVER['REQUEST_METHOD'] === 'GET' && $_SERVER['REQUEST_URI'] === '/paypal-api/vault/payment-tokens') {
    header('Content-Type: application/json');
    
    try {
        $customerId = $_GET['customer_id'] ?? null;
        
        if (empty($customerId)) {
            http_response_code(400);
            echo json_encode([
                'error' => 'MISSING_CUSTOMER_ID',
                'message' => 'customer_id query parameter is required'
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

if ($_SERVER['REQUEST_METHOD'] === 'GET' && preg_match('/^\/paypal-api\/vault\/payment-tokens\/([^\/]+)$/', $_SERVER['REQUEST_URI'], $matches)) {
    header('Content-Type: application/json');
    
    try {
        $tokenId = $matches[1];
        $accessToken = getAccessToken();
        
        $ch = curl_init($paypalBase . '/v3/vault/payment-tokens/' . $tokenId);
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
            echo json_encode(['error' => 'TOKEN_NOT_FOUND']);
            exit;
        }
        
        echo $response;
        
    } catch (Exception $e) {
        http_response_code(500);
        echo json_encode(['error' => 'FETCH_FAILED']);
    }
    exit;
}

if ($_SERVER['REQUEST_METHOD'] === 'DELETE' && preg_match('/^\/paypal-api\/vault\/payment-tokens\/([^\/]+)$/', $_SERVER['REQUEST_URI'], $matches)) {
    header('Content-Type: application/json');
    
    try {
        $tokenId = $matches[1];
        $accessToken = getAccessToken();
        
        $ch = curl_init($paypalBase . '/v3/vault/payment-tokens/' . $tokenId);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_CUSTOMREQUEST, 'DELETE');
        curl_setopt($ch, CURLOPT_HTTPHEADER, [
            'Authorization: Bearer ' . $accessToken,
            'Content-Type: application/json'
        ]);
        
        curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);
        
        if ($httpCode === 204) {
            echo json_encode([
                'success' => true,
                'message' => 'Payment token deleted successfully'
            ]);
        } else {
            http_response_code($httpCode);
            echo json_encode(['success' => false]);
        }
        
    } catch (Exception $e) {
        http_response_code(500);
        echo json_encode(['error' => 'DELETE_FAILED']);
    }
    exit;
}
```

