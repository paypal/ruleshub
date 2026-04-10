#### Enhanced Error Handling with Debug IDs

```php
<?php

function createOrderWithErrorHandling() {
    try {
        $body = json_decode(file_get_contents('php://input'), true);
        $accessToken = getAccessToken();
        $paypalBase = getenv('PAYPAL_BASE') ?: 'https://api-m.sandbox.paypal.com';
        
        $orderPayload = [
            'intent' => 'CAPTURE',
            'purchase_units' => [[
                'amount' => [
                    'currency_code' => $body['currency'] ?? 'USD',
                    'value' => $body['amount']
                ]
            ]]
        ];
        
        $ch = curl_init();
        curl_setopt($ch, CURLOPT_URL, "$paypalBase/v2/checkout/orders");
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_POST, true);
        curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($orderPayload));
        curl_setopt($ch, CURLOPT_HEADER, true);
        curl_setopt($ch, CURLOPT_HTTPHEADER, [
            'Content-Type: application/json',
            "Authorization: Bearer $accessToken",
            'PayPal-Request-Id: ' . uniqid()
        ]);
        
        $response = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $headerSize = curl_getinfo($ch, CURLINFO_HEADER_SIZE);
        curl_close($ch);
        
        $headers = substr($response, 0, $headerSize);
        $body = substr($response, $headerSize);
        
        if ($httpCode >= 200 && $httpCode < 300) {
            header('Content-Type: application/json');
            echo $body;
        } else {
            $debugId = 'N/A';
            if (preg_match('/PayPal-Debug-Id: ([^\r\n]+)/i', $headers, $matches)) {
                $debugId = trim($matches[1]);
            }
            
            $errorData = json_decode($body, true) ?? [];
            
            error_log("Order creation failed - Debug ID: $debugId");
            error_log("Status: $httpCode");
            error_log("Error: " . json_encode($errorData));
            
            http_response_code($httpCode);
            header('Content-Type: application/json');
            echo json_encode([
                'error' => 'ORDER_CREATION_FAILED',
                'debugId' => $debugId,
                'status' => $httpCode,
                'details' => $errorData['details'] ?? [],
                'message' => $errorData['message'] ?? 'Failed to create order'
            ]);
        }
        
    } catch (Exception $e) {
        http_response_code(500);
        echo json_encode([
            'error' => 'INTERNAL_ERROR',
            'message' => 'An unexpected error occurred'
        ]);
    }
}
?>
```

#### Error Handler Function

```php
<?php

function handlePayPalError($response, $headers, $httpCode) {
    $debugId = 'N/A';
    if (preg_match('/PayPal-Debug-Id: ([^\r\n]+)/i', $headers, $matches)) {
        $debugId = trim($matches[1]);
    }
    
    $errorData = json_decode($response, true) ?? [];
    
    error_log("PayPal API Error - Debug ID: $debugId");
    error_log("Status: $httpCode");
    error_log("Details: " . json_encode($errorData));
    
    http_response_code($httpCode);
    header('Content-Type: application/json');
    echo json_encode([
        'error' => $errorData['name'] ?? 'API_ERROR',
        'debugId' => $debugId,
        'message' => $errorData['message'] ?? 'PayPal API error',
        'details' => $errorData['details'] ?? []
    ]);
}
?>
```

#### Specific Error Handlers

```php
<?php

function handleValidationError($errorResponse, $debugId) {
    $errorData = json_decode($errorResponse, true) ?? [];
    $fieldErrors = [];
    
    foreach ($errorData['details'] ?? [] as $detail) {
        $fieldErrors[] = [
            'field' => $detail['field'] ?? null,
            'issue' => $detail['issue'] ?? null,
            'description' => $detail['description'] ?? null
        ];
    }
    
    return [
        'error' => 'VALIDATION_ERROR',
        'debugId' => $debugId,
        'message' => 'Invalid request data',
        'fieldErrors' => $fieldErrors
    ];
}

function handleAuthenticationError($debugId) {
    return [
        'error' => 'AUTHENTICATION_FAILED',
        'debugId' => $debugId,
        'message' => 'Invalid or expired credentials'
    ];
}

function handlePaymentError($errorResponse, $debugId) {
    $errorData = json_decode($errorResponse, true) ?? [];
    $errorName = $errorData['name'] ?? '';
    $userMessage = 'Payment could not be processed';
    
    if (strpos($errorName, 'INSTRUMENT_DECLINED') !== false) {
        $userMessage = 'Payment method was declined. Please try another payment method.';
    } elseif (strpos($errorName, 'INSUFFICIENT_FUNDS') !== false) {
        $userMessage = 'Insufficient funds. Please try another payment method.';
    } elseif (strpos($errorName, 'ORDER_NOT_APPROVED') !== false) {
        $userMessage = 'Order was not approved. Please try again.';
    }
    
    return [
        'error' => $errorName,
        'debugId' => $debugId,
        'message' => $userMessage,
        'details' => $errorData['details'] ?? []
    ];
}
?>
```

#### Error Logger

```php
<?php

function logPayPalError($operation, $debugId, $httpCode, $errorData, $requestData = null) {
    $logEntry = [
        'timestamp' => date('Y-m-d H:i:s'),
        'operation' => $operation,
        'debug_id' => $debugId,
        'status_code' => $httpCode,
        'error_name' => $errorData['name'] ?? null,
        'error_message' => $errorData['message'] ?? null,
        'error_details' => $errorData['details'] ?? [],
        'request_data' => $requestData
    ];
    
    error_log("PayPal API Error: " . json_encode($logEntry));
    
    return $debugId;
}

function createOrderWithLogging() {
    try {
        $body = json_decode(file_get_contents('php://input'), true);
        $accessToken = getAccessToken();
        $paypalBase = getenv('PAYPAL_BASE') ?: 'https://api-m.sandbox.paypal.com';
        
        $ch = curl_init();
        curl_setopt($ch, CURLOPT_URL, "$paypalBase/v2/checkout/orders");
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_POST, true);
        curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($body));
        curl_setopt($ch, CURLOPT_HEADER, true);
        curl_setopt($ch, CURLOPT_HTTPHEADER, [
            'Content-Type: application/json',
            "Authorization: Bearer $accessToken",
            'PayPal-Request-Id: ' . uniqid()
        ]);
        
        $response = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $headerSize = curl_getinfo($ch, CURLINFO_HEADER_SIZE);
        curl_close($ch);
        
        $headers = substr($response, 0, $headerSize);
        $responseBody = substr($response, $headerSize);
        
        if ($httpCode < 200 || $httpCode >= 300) {
            $debugId = 'N/A';
            if (preg_match('/PayPal-Debug-Id: ([^\r\n]+)/i', $headers, $matches)) {
                $debugId = trim($matches[1]);
            }
            
            $errorData = json_decode($responseBody, true) ?? [];
            logPayPalError('create_order', $debugId, $httpCode, $errorData, $body);
            
            http_response_code($httpCode);
            header('Content-Type: application/json');
            echo json_encode([
                'error' => 'ORDER_CREATION_FAILED',
                'debugId' => $debugId,
                'message' => 'Please contact support with this reference number'
            ]);
        } else {
            header('Content-Type: application/json');
            echo $responseBody;
        }
        
    } catch (Exception $e) {
        error_log("Unexpected error creating order: " . $e->getMessage());
        http_response_code(500);
        echo json_encode(['error' => 'INTERNAL_ERROR']);
    }
}
?>
```

