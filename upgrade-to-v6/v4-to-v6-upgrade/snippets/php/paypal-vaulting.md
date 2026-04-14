#### Create Setup Token (Save PayPal Without Purchase)

```php
<?php

function createSetupToken() {
    try {
        $accessToken = getAccessToken();
        $paypalBase = getenv('PAYPAL_BASE') ?: 'https://api-m.sandbox.paypal.com';
        
        $setupTokenPayload = [
            'payment_source' => [
                'paypal' => [
                    'usage_type' => 'MERCHANT',
                    'customer_type' => 'CONSUMER',
                    'permit_multiple_payment_tokens' => true
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
        $setupData = json_decode($response, true);
        curl_close($ch);
        
        http_response_code($httpCode);
        header('Content-Type: application/json');
        echo json_encode([
            'id' => $setupData['id'] ?? null,
            'status' => $setupData['status'] ?? null
        ]);
        
    } catch (Exception $e) {
        http_response_code(500);
        echo json_encode(['error' => 'SETUP_TOKEN_FAILED']);
    }
}
?>
```

#### Create Payment Token from Setup Token

```php
<?php

function createPaymentToken() {
    try {
        $body = json_decode(file_get_contents('php://input'), true);
        $accessToken = getAccessToken();
        $paypalBase = getenv('PAYPAL_BASE') ?: 'https://api-m.sandbox.paypal.com';
        
        $paymentTokenPayload = [
            'payment_source' => [
                'token' => [
                    'id' => $body['vaultSetupToken'],
                    'type' => 'SETUP_TOKEN'
                ]
            ]
        ];
        
        $ch = curl_init();
        curl_setopt($ch, CURLOPT_URL, "$paypalBase/v3/vault/payment-tokens");
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_POST, true);
        curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($paymentTokenPayload));
        curl_setopt($ch, CURLOPT_HTTPHEADER, [
            'Content-Type: application/json',
            "Authorization: Bearer $accessToken",
            'PayPal-Request-Id: ' . uniqid()
        ]);
        
        $response = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $tokenData = json_decode($response, true);
        curl_close($ch);
        
        $paymentTokenId = $tokenData['id'] ?? null;
        $customerId = $tokenData['customer']['id'] ?? null;
        
        http_response_code($httpCode);
        header('Content-Type: application/json');
        echo json_encode([
            'id' => $paymentTokenId,
            'customerId' => $customerId,
            'status' => 'saved'
        ]);
        
    } catch (Exception $e) {
        http_response_code(500);
        echo json_encode(['error' => 'PAYMENT_TOKEN_FAILED']);
    }
}
?>
```

#### Create Order with Saved PayPal

```php
<?php

function createOrderWithPaymentToken() {
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
                'paypal' => [
                    'vault_id' => $body['paymentTokenId']
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
        $orderData = json_decode($response, true);
        
        if ($orderData['status'] === 'CREATED') {
            $captureResponse = captureOrderInternal($orderData['id'], $accessToken, $paypalBase);
            echo $captureResponse;
        } else {
            echo $response;
        }
        
    } catch (Exception $e) {
        http_response_code(500);
        echo json_encode(['error' => 'ORDER_FAILED']);
    }
}
?>
```

#### List Saved Payment Methods

```php
<?php

function listPaymentMethods() {
    try {
        $customerId = $_GET['customer_id'] ?? '';
        $accessToken = getAccessToken();
        $paypalBase = getenv('PAYPAL_BASE') ?: 'https://api-m.sandbox.paypal.com';
        
        $ch = curl_init();
        curl_setopt($ch, CURLOPT_URL, "$paypalBase/v3/vault/payment-tokens?customer_id=$customerId");
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_HTTPHEADER, [
            'Content-Type: application/json',
            "Authorization: Bearer $accessToken"
        ]);
        
        $response = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $tokensData = json_decode($response, true);
        curl_close($ch);
        
        http_response_code($httpCode);
        header('Content-Type: application/json');
        echo json_encode([
            'payment_tokens' => $tokensData['payment_tokens'] ?? [],
            'total_items' => count($tokensData['payment_tokens'] ?? [])
        ]);
        
    } catch (Exception $e) {
        http_response_code(500);
        echo json_encode(['error' => 'FETCH_FAILED']);
    }
}
?>
```

#### Delete Saved Payment Method

```php
<?php

function deletePaymentMethod($tokenId) {
    try {
        $accessToken = getAccessToken();
        $paypalBase = getenv('PAYPAL_BASE') ?: 'https://api-m.sandbox.paypal.com';
        
        $ch = curl_init();
        curl_setopt($ch, CURLOPT_URL, "$paypalBase/v3/vault/payment-tokens/$tokenId");
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_CUSTOMREQUEST, 'DELETE');
        curl_setopt($ch, CURLOPT_HTTPHEADER, [
            'Content-Type: application/json',
            "Authorization: Bearer $accessToken"
        ]);
        
        $response = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);
        
        if ($httpCode === 204) {
            http_response_code(200);
            echo json_encode(['success' => true, 'message' => 'Payment method deleted']);
        } else {
            http_response_code($httpCode);
            echo json_encode(['success' => false]);
        }
        
    } catch (Exception $e) {
        http_response_code(500);
        echo json_encode(['error' => 'DELETE_FAILED']);
    }
}
?>
```

