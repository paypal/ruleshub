#### Create Order with AUTHORIZE Intent

```php
<?php

function createOrderAuthorize() {
    try {
        $body = json_decode(file_get_contents('php://input'), true);
        $accessToken = getAccessToken();
        $paypalBase = getenv('PAYPAL_BASE') ?: 'https://api-m.sandbox.paypal.com';
        
        $orderPayload = [
            'intent' => 'AUTHORIZE',
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

#### Authorize Order

```php
<?php

function authorizeOrder($orderId) {
    try {
        $accessToken = getAccessToken();
        $paypalBase = getenv('PAYPAL_BASE') ?: 'https://api-m.sandbox.paypal.com';
        
        $ch = curl_init();
        curl_setopt($ch, CURLOPT_URL, "$paypalBase/v2/checkout/orders/$orderId/authorize");
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
        $authData = json_decode($response, true);
        curl_close($ch);
        
        $authorizationId = $authData['purchase_units'][0]['payments']['authorizations'][0]['id'] ?? null;
        
        http_response_code($httpCode);
        header('Content-Type: application/json');
        echo json_encode([
            'authorizationId' => $authorizationId,
            'status' => $authData['status'] ?? null,
            'details' => $authData
        ]);
        
    } catch (Exception $e) {
        http_response_code(500);
        echo json_encode(['error' => 'AUTHORIZATION_FAILED']);
    }
}
?>
```

#### Capture Authorization

```php
<?php

function captureAuthorization($authorizationId) {
    try {
        $body = json_decode(file_get_contents('php://input'), true);
        $accessToken = getAccessToken();
        $paypalBase = getenv('PAYPAL_BASE') ?: 'https://api-m.sandbox.paypal.com';
        
        $capturePayload = [];
        
        if (!empty($body['amount'])) {
            $capturePayload['amount'] = [
                'value' => $body['amount'],
                'currency_code' => $body['currency'] ?? 'USD'
            ];
        }
        
        $capturePayload['final_capture'] = $body['finalCapture'] ?? true;
        
        if (!empty($body['invoiceId'])) {
            $capturePayload['invoice_id'] = $body['invoiceId'];
        }
        
        if (!empty($body['noteToPayer'])) {
            $capturePayload['note_to_payer'] = $body['noteToPayer'];
        }
        
        $ch = curl_init();
        curl_setopt($ch, CURLOPT_URL, "$paypalBase/v2/payments/authorizations/$authorizationId/capture");
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_POST, true);
        curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($capturePayload));
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
        echo json_encode(['error' => 'CAPTURE_FAILED']);
    }
}
?>
```

#### Get Authorization Details

```php
<?php

function getAuthorizationDetails($authorizationId) {
    try {
        $accessToken = getAccessToken();
        $paypalBase = getenv('PAYPAL_BASE') ?: 'https://api-m.sandbox.paypal.com';
        
        $ch = curl_init();
        curl_setopt($ch, CURLOPT_URL, "$paypalBase/v2/payments/authorizations/$authorizationId");
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_HTTPHEADER, [
            'Content-Type: application/json',
            "Authorization: Bearer $accessToken"
        ]);
        
        $response = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);
        
        http_response_code($httpCode);
        header('Content-Type: application/json');
        echo $response;
        
    } catch (Exception $e) {
        http_response_code(500);
        echo json_encode(['error' => 'FETCH_FAILED']);
    }
}
?>
```

