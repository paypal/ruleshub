#### Create Order (Basic)

```php
<?php

function createOrder() {
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

#### Create Order with Details

```php
<?php

function createOrderWithDetails() {
    try {
        $body = json_decode(file_get_contents('php://input'), true);
        $accessToken = getAccessToken();
        $paypalBase = getenv('PAYPAL_BASE') ?: 'https://api-m.sandbox.paypal.com';
        
        $items = [];
        foreach ($body['items'] ?? [] as $item) {
            $items[] = [
                'name' => $item['name'],
                'quantity' => (string)$item['quantity'],
                'unit_amount' => [
                    'currency_code' => $body['currency'] ?? 'USD',
                    'value' => $item['price']
                ],
                'sku' => $item['sku'] ?? null
            ];
        }
        
        $orderPayload = [
            'intent' => 'CAPTURE',
            'purchase_units' => [[
                'amount' => [
                    'currency_code' => $body['currency'] ?? 'USD',
                    'value' => $body['amount'],
                    'breakdown' => [
                        'item_total' => [
                            'currency_code' => $body['currency'] ?? 'USD',
                            'value' => $body['details']['subtotal'] ?? $body['amount']
                        ],
                        'shipping' => [
                            'currency_code' => $body['currency'] ?? 'USD',
                            'value' => $body['details']['shipping'] ?? '0.00'
                        ],
                        'tax_total' => [
                            'currency_code' => $body['currency'] ?? 'USD',
                            'value' => $body['details']['tax'] ?? '0.00'
                        ]
                    ]
                ],
                'description' => $body['description'] ?? 'Purchase',
                'items' => $items
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

