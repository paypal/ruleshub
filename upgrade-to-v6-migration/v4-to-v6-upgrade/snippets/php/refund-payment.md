#### Full Refund

```php
<?php

function refundPayment($captureId) {
    try {
        $accessToken = getAccessToken();
        $paypalBase = getenv('PAYPAL_BASE') ?: 'https://api-m.sandbox.paypal.com';
        
        $ch = curl_init();
        curl_setopt($ch, CURLOPT_URL, "$paypalBase/v2/payments/captures/$captureId/refund");
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
        curl_close($ch);
        
        http_response_code($httpCode);
        header('Content-Type: application/json');
        echo $response;
        
    } catch (Exception $e) {
        http_response_code(500);
        echo json_encode(['error' => 'REFUND_FAILED']);
    }
}
?>
```

#### Partial Refund

```php
<?php

function refundPaymentPartial($captureId) {
    try {
        $body = json_decode(file_get_contents('php://input'), true);
        $accessToken = getAccessToken();
        $paypalBase = getenv('PAYPAL_BASE') ?: 'https://api-m.sandbox.paypal.com';
        
        $refundPayload = [
            'amount' => [
                'value' => $body['amount'],
                'currency_code' => $body['currency'] ?? 'USD'
            ]
        ];
        
        if (!empty($body['note'])) {
            $refundPayload['note_to_payer'] = $body['note'];
        }
        
        if (!empty($body['invoiceId'])) {
            $refundPayload['invoice_id'] = $body['invoiceId'];
        }
        
        $ch = curl_init();
        curl_setopt($ch, CURLOPT_URL, "$paypalBase/v2/payments/captures/$captureId/refund");
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_POST, true);
        curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($refundPayload));
        curl_setopt($ch, CURLOPT_HTTPHEADER, [
            'Content-Type: application/json',
            "Authorization: Bearer $accessToken",
            'PayPal-Request-Id: ' . uniqid()
        ]);
        
        $response = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $refundData = json_decode($response, true);
        curl_close($ch);
        
        http_response_code($httpCode);
        header('Content-Type: application/json');
        echo json_encode([
            'refundId' => $refundData['id'] ?? null,
            'status' => $refundData['status'] ?? null,
            'amount' => $refundData['amount'] ?? null,
            'details' => $refundData
        ]);
        
    } catch (Exception $e) {
        http_response_code(500);
        echo json_encode(['error' => 'REFUND_FAILED']);
    }
}
?>
```

#### Get Refund Details

```php
<?php

function getRefundDetails($refundId) {
    try {
        $accessToken = getAccessToken();
        $paypalBase = getenv('PAYPAL_BASE') ?: 'https://api-m.sandbox.paypal.com';
        
        $ch = curl_init();
        curl_setopt($ch, CURLOPT_URL, "$paypalBase/v2/payments/refunds/$refundId");
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

#### Get Order Details for Refund

```php
<?php

function getOrderDetailsForRefund($orderId) {
    try {
        $accessToken = getAccessToken();
        $paypalBase = getenv('PAYPAL_BASE') ?: 'https://api-m.sandbox.paypal.com';
        
        $ch = curl_init();
        curl_setopt($ch, CURLOPT_URL, "$paypalBase/v2/checkout/orders/$orderId");
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_HTTPHEADER, [
            'Content-Type: application/json',
            "Authorization: Bearer $accessToken"
        ]);
        
        $response = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $orderData = json_decode($response, true);
        curl_close($ch);
        
        $captures = $orderData['purchase_units'][0]['payments']['captures'] ?? [];
        $captureId = $captures[0]['id'] ?? null;
        
        http_response_code($httpCode);
        header('Content-Type: application/json');
        echo json_encode([
            'orderId' => $orderId,
            'captureId' => $captureId,
            'status' => $orderData['status'] ?? null,
            'details' => $orderData
        ]);
        
    } catch (Exception $e) {
        http_response_code(500);
        echo json_encode(['error' => 'FETCH_FAILED']);
    }
}
?>
```

