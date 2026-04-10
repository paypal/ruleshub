# Error Handling (Server-Side)

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

function logPayPalError($operation, $debugId, $statusCode, $errorBody) {
    error_log("PayPal API Error:");
    error_log("  Operation: " . $operation);
    error_log("  Debug ID: " . $debugId);
    error_log("  Status Code: " . $statusCode);
    error_log("  Error Body: " . $errorBody);
}

function handleValidationError($errorData, $debugId) {
    return [
        'error' => 'VALIDATION_ERROR',
        'debugId' => $debugId,
        'message' => 'Invalid request data'
    ];
}

function handleAuthenticationError($debugId) {
    return [
        'error' => 'AUTHENTICATION_FAILED',
        'debugId' => $debugId,
        'message' => 'Invalid or expired credentials'
    ];
}

function handlePaymentError($errorData, $debugId) {
    return [
        'error' => 'PAYMENT_ERROR',
        'debugId' => $debugId,
        'message' => 'Payment could not be processed'
    ];
}

if ($_SERVER['REQUEST_METHOD'] === 'POST' && $_SERVER['REQUEST_URI'] === '/paypal-api/checkout/orders/create-with-error-handling') {
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
        
        $ch = curl_init($paypalBase . '/v2/checkout/orders');
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_POST, true);
        curl_setopt($ch, CURLOPT_HEADER, true);
        curl_setopt($ch, CURLOPT_HTTPHEADER, [
            'Content-Type: application/json',
            'Authorization: Bearer ' . $accessToken
        ]);
        curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($orderPayload));
        
        $response = curl_exec($ch);
        $headerSize = curl_getinfo($ch, CURLINFO_HEADER_SIZE);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);
        
        $headers = substr($response, 0, $headerSize);
        $body = substr($response, $headerSize);
        
        if ($httpCode === 200 || $httpCode === 201) {
            echo $body;
            exit;
        }
        
        preg_match('/paypal-debug-id:\s*([^\r\n]+)/i', $headers, $matches);
        $debugId = $matches[1] ?? 'N/A';
        
        logPayPalError('create_order', $debugId, $httpCode, $body);
        
        $errorData = json_decode($body, true);
        
        if ($httpCode === 400) {
            http_response_code(400);
            echo json_encode(handleValidationError($errorData, $debugId));
        } elseif ($httpCode === 401) {
            http_response_code(401);
            echo json_encode(handleAuthenticationError($debugId));
        } elseif ($httpCode === 422) {
            http_response_code(422);
            echo json_encode(handlePaymentError($errorData, $debugId));
        } else {
            http_response_code($httpCode);
            echo json_encode([
                'error' => 'ORDER_CREATION_FAILED',
                'debugId' => $debugId,
                'message' => 'Failed to create order'
            ]);
        }
        
    } catch (Exception $e) {
        http_response_code(500);
        echo json_encode([
            'error' => 'INTERNAL_ERROR',
            'message' => 'An unexpected error occurred'
        ]);
    }
    exit;
}
```

