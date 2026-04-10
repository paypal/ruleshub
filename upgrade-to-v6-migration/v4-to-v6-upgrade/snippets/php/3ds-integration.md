#### Create Order with 3D Secure (Always)

```php
<?php

function createOrderWith3DS() {
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
            ]],
            'payment_source' => [
                'card' => [
                    'attributes' => [
                        'verification' => [
                            'method' => 'SCA_ALWAYS'
                        ]
                    ],
                    'experience_context' => [
                        'return_url' => 'https://example.com/returnUrl',
                        'cancel_url' => 'https://example.com/cancelUrl'
                    ]
                ]
            ]
        ];
        
        $ch = curl_init();
        curl_setopt($ch, CURLOPT_URL, "$paypalBase/v2/checkout/orders");
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_POST, true);
        curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($orderPayload));
        curl_setopt($ch, CURLOPT_HTTPHEADER, [
            'Content-Type: application/json',
            "Authorization: Bearer $accessToken",
            'PayPal-Request-Id: ' . uniqid()
        ]);
        
        $response = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);
        
        http_response_code($httpCode);
        header('Content-Type: application/json');
        echo $response;
        
    } catch (Exception $e) {
        http_response_code(500);
        echo json_encode(['error' => 'ORDER_CREATION_FAILED']);
    }
}
?>
```

#### Create Order with SCA When Required

```php
<?php

function createOrderWithSCA() {
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
            ]],
            'payment_source' => [
                'card' => [
                    'attributes' => [
                        'verification' => [
                            'method' => 'SCA_WHEN_REQUIRED'
                        ]
                    ],
                    'experience_context' => [
                        'return_url' => 'https://example.com/returnUrl',
                        'cancel_url' => 'https://example.com/cancelUrl'
                    ]
                ]
            ]
        ];
        
        $ch = curl_init();
        curl_setopt($ch, CURLOPT_URL, "$paypalBase/v2/checkout/orders");
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_POST, true);
        curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($orderPayload));
        curl_setopt($ch, CURLOPT_HTTPHEADER, [
            'Content-Type: application/json',
            "Authorization: Bearer $accessToken",
            'PayPal-Request-Id: ' . uniqid()
        ]);
        
        $response = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);
        
        http_response_code($httpCode);
        header('Content-Type: application/json');
        echo $response;
        
    } catch (Exception $e) {
        http_response_code(500);
        echo json_encode(['error' => 'ORDER_CREATION_FAILED']);
    }
}
?>
```

#### Vault Setup Token with 3DS

```php
<?php

function createVaultSetupTokenWith3DS() {
    try {
        $body = json_decode(file_get_contents('php://input'), true);
        $accessToken = getAccessToken();
        $paypalBase = getenv('PAYPAL_BASE') ?: 'https://api-m.sandbox.paypal.com';
        
        $setupTokenPayload = [
            'payment_source' => [
                'card' => [
                    'experience_context' => [
                        'return_url' => 'https://example.com/returnUrl',
                        'cancel_url' => 'https://example.com/cancelUrl'
                    ],
                    'verification_method' => $body['scaMethod'] ?? 'SCA_WHEN_REQUIRED'
                ]
            ]
        ];
        
        $ch = curl_init();
        curl_setopt($ch, CURLOPT_URL, "$paypalBase/v3/vault/setup-tokens");
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_POST, true);
        curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($setupTokenPayload));
        curl_setopt($ch, CURLOPT_HTTPHEADER, [
            'Content-Type: application/json',
            "Authorization: Bearer $accessToken",
            'PayPal-Request-Id: ' . uniqid()
        ]);
        
        $response = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);
        
        http_response_code($httpCode);
        header('Content-Type: application/json');
        echo $response;
        
    } catch (Exception $e) {
        http_response_code(500);
        echo json_encode(['error' => 'SETUP_TOKEN_FAILED']);
    }
}
?>
```

#### Capture with 3DS Logging

```php
<?php

function captureWith3DSLogging($orderId) {
    try {
        $accessToken = getAccessToken();
        $paypalBase = getenv('PAYPAL_BASE') ?: 'https://api-m.sandbox.paypal.com';
        
        $ch = curl_init();
        curl_setopt($ch, CURLOPT_URL, "$paypalBase/v2/checkout/orders/$orderId/capture");
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_POST, true);
        curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode([]));
        curl_setopt($ch, CURLOPT_HTTPHEADER, [
            'Content-Type: application/json',
            "Authorization: Bearer $accessToken",
            'PayPal-Request-Id: ' . uniqid()
        ]);
        
        $response = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $captureData = json_decode($response, true);
        curl_close($ch);
        
        $authResult = $captureData['payment_source']['card']['authentication_result'] ?? [];
        
        if (!empty($authResult)) {
            $threeDS = $authResult['three_d_secure'] ?? [];
            error_log("3DS Authentication Result:");
            error_log("  Order ID: " . ($captureData['id'] ?? ''));
            error_log("  Liability Shift: " . ($authResult['liability_shift'] ?? ''));
            error_log("  Auth Status: " . ($threeDS['authentication_status'] ?? ''));
            error_log("  Enrollment Status: " . ($threeDS['enrollment_status'] ?? ''));
        }
        
        http_response_code($httpCode);
        header('Content-Type: application/json');
        echo $response;
        
    } catch (Exception $e) {
        http_response_code(500);
        echo json_encode(['error' => 'CAPTURE_FAILED']);
    }
}
?>
```

