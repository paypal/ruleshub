# Pay Later Server-Side (PHP) — US

Server-side order creation and capture for Pay Later. No special order payload is needed.

Source: https://docs.paypal.ai/reference/api/rest/orders/create-order

## PHP Implementation

```php
<?php

$clientId = getenv('PAYPAL_CLIENT_ID');
$clientSecret = getenv('PAYPAL_CLIENT_SECRET');
$baseUrl = getenv('PAYPAL_BASE_URL') ?: 'https://api-m.sandbox.paypal.com';

function getAccessToken() {
    global $clientId, $clientSecret, $baseUrl;

    $ch = curl_init();
    curl_setopt($ch, CURLOPT_URL, "$baseUrl/v1/oauth2/token");
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_POST, true);
    curl_setopt($ch, CURLOPT_USERPWD, "$clientId:$clientSecret");
    curl_setopt($ch, CURLOPT_POSTFIELDS, 'grant_type=client_credentials');
    curl_setopt($ch, CURLOPT_HTTPHEADER, [
        'Content-Type: application/x-www-form-urlencoded'
    ]);

    $response = curl_exec($ch);
    curl_close($ch);

    $data = json_decode($response, true);
    return $data['access_token'];
}

function createOrder($amount, $currencyCode = 'USD') {
    global $baseUrl;

    $accessToken = getAccessToken();

    $orderPayload = [
        'intent' => 'CAPTURE',
        'purchase_units' => [[
            'amount' => [
                'currency_code' => $currencyCode,
                'value' => number_format((float) $amount, 2, '.', '')
            ]
        ]]
    ];

    $ch = curl_init();
    curl_setopt($ch, CURLOPT_URL, "$baseUrl/v2/checkout/orders");
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_POST, true);
    curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($orderPayload));
    curl_setopt($ch, CURLOPT_HTTPHEADER, [
        'Content-Type: application/json',
        "Authorization: Bearer $accessToken",
        'PayPal-Request-Id: ' . uniqid('', true)
    ]);

    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    return ['body' => json_decode($response, true), 'status' => $httpCode];
}

function captureOrder($orderId) {
    global $baseUrl;

    $accessToken = getAccessToken();

    $ch = curl_init();
    curl_setopt($ch, CURLOPT_URL, "$baseUrl/v2/checkout/orders/$orderId/capture");
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_POST, true);
    curl_setopt($ch, CURLOPT_POSTFIELDS, '');
    curl_setopt($ch, CURLOPT_HTTPHEADER, [
        'Content-Type: application/json',
        "Authorization: Bearer $accessToken",
        'PayPal-Request-Id: ' . uniqid('', true)
    ]);

    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    return ['body' => json_decode($response, true), 'status' => $httpCode];
}
```

## Key Points

- No special API fields for Pay Later — standard `POST /v2/checkout/orders` works
- Use `intent: CAPTURE` for Pay Later transactions
- Store credentials in environment variables, never hardcoded
- US Pay in 4: $30–$1,500; Pay Monthly: $49–$10,000
