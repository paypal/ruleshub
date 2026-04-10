# Capture Order — Server-Side

After the buyer approves in the PayPal popup or redirect, your frontend sends the **order ID** to your server. You **capture** funds with **POST** `/v2/checkout/orders/{order_id}/capture`.

## PayPal API

**POST** `{base}/v2/checkout/orders/{order_id}/capture`

- **Sandbox:** `https://api-m.sandbox.paypal.com/v2/checkout/orders/{id}/capture`
- **Production:** `https://api-m.paypal.com/v2/checkout/orders/{id}/capture`

Optional JSON body: `{}` or partial capture fields per [Orders API](https://developer.paypal.com/docs/api/orders/v2/#orders_capture).

## Vanilla PHP — POST `/paypal-api/checkout/orders/capture`

```php
<?php
declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');

function paypal_base_url(): string
{
    $env = $_ENV['PAYPAL_ENVIRONMENT'] ?? getenv('PAYPAL_ENVIRONMENT') ?: 'sandbox';
    return $env === 'production'
        ? 'https://api-m.paypal.com'
        : 'https://api-m.sandbox.paypal.com';
}

function paypal_access_token(string $baseUrl, string $clientId, string $secret): string
{
    $url = $baseUrl . '/v1/oauth2/token';
    $ch = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_POST => true,
        CURLOPT_POSTFIELDS => 'grant_type=client_credentials',
        CURLOPT_HTTPHEADER => [
            'Authorization: Basic ' . base64_encode($clientId . ':' . $secret),
            'Content-Type: application/x-www-form-urlencoded',
            'Accept: application/json',
        ],
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT => 30,
    ]);
    $body = curl_exec($ch);
    $errno = curl_errno($ch);
    $errstr = curl_error($ch);
    $http = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    if ($errno !== 0 || !is_string($body)) {
        throw new RuntimeException('OAuth error: ' . $errstr);
    }
    if ($http < 200 || $http >= 300) {
        throw new RuntimeException('OAuth HTTP ' . $http . ': ' . $body);
    }
    $data = json_decode($body, true, 512, JSON_THROW_ON_ERROR);
    return (string) ($data['access_token'] ?? '');
}

try {
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
        http_response_code(405);
        echo json_encode(['error' => 'Method not allowed']);
        exit;
    }

    $raw = file_get_contents('php://input');
    $in = json_decode($raw ?: '{}', true, 512, JSON_THROW_ON_ERROR);
    $orderId = (string) ($in['orderID'] ?? $in['order_id'] ?? '');
    if ($orderId === '' || !preg_match('/^[A-Z0-9-]+$/', $orderId)) {
        http_response_code(400);
        echo json_encode(['error' => 'Invalid orderID']);
        exit;
    }

    $clientId = $_ENV['PAYPAL_CLIENT_ID'] ?? getenv('PAYPAL_CLIENT_ID') ?: '';
    $secret = $_ENV['PAYPAL_CLIENT_SECRET'] ?? getenv('PAYPAL_CLIENT_SECRET') ?: '';
    if ($clientId === '' || $secret === '') {
        throw new RuntimeException('PayPal credentials missing');
    }

    $base = paypal_base_url();
    $token = paypal_access_token($base, $clientId, $secret);
    $url = $base . '/v2/checkout/orders/' . rawurlencode($orderId) . '/capture';

    $ch = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_POST => true,
        CURLOPT_POSTFIELDS => '{}',
        CURLOPT_HTTPHEADER => [
            'Authorization: Bearer ' . $token,
            'Content-Type: application/json',
            'Accept: application/json',
            'Prefer: return=representation',
        ],
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_HEADER => true,
        CURLOPT_TIMEOUT => 30,
    ]);
    $rawResponse = curl_exec($ch);
    $errno = curl_errno($ch);
    $errstr = curl_error($ch);
    $http = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $headerSize = (int) curl_getinfo($ch, CURLINFO_HEADER_SIZE);
    curl_close($ch);

    if ($errno !== 0 || !is_string($rawResponse)) {
        throw new RuntimeException('Capture cURL error: ' . $errstr);
    }

    $headers = substr($rawResponse, 0, $headerSize);
    $body = substr($rawResponse, $headerSize);
    $debugId = null;
    if (preg_match('/paypal-debug-id:\s*(\S+)/i', $headers, $m)) {
        $debugId = $m[1];
    }

    $decoded = json_decode($body, true, 512, JSON_THROW_ON_ERROR);

    if ($http < 200 || $http >= 300) {
        http_response_code($http >= 400 && $http < 600 ? $http : 502);
        echo json_encode([
            'error' => $decoded['message'] ?? 'Capture failed',
            'details' => $decoded['details'] ?? null,
            'paypalDebugId' => $debugId,
        ], JSON_THROW_ON_ERROR);
        exit;
    }

    $capture = null;
    foreach ($decoded['purchase_units'] ?? [] as $pu) {
        foreach ($pu['payments']['captures'] ?? [] as $c) {
            $capture = $c;
            break 2;
        }
    }

    echo json_encode([
        'orderID' => $decoded['id'] ?? $orderId,
        'status' => $decoded['status'] ?? null,
        'captureId' => $capture['id'] ?? null,
        'captureStatus' => $capture['status'] ?? null,
        'paypalDebugId' => $debugId,
    ], JSON_THROW_ON_ERROR);
} catch (Throwable $e) {
    http_response_code(500);
    echo json_encode(['error' => $e->getMessage()]);
}
```

## Optional: Laravel

```php
<?php

public function capture(Request $request)
{
    $data = $request->validate([
        'orderID' => 'required|string',
    ]);

    $base = config('services.paypal.environment') === 'production'
        ? 'https://api-m.paypal.com'
        : 'https://api-m.sandbox.paypal.com';

    $oauth = Http::asForm()
        ->withBasicAuth(config('services.paypal.client_id'), config('services.paypal.secret'))
        ->post($base . '/v1/oauth2/token', ['grant_type' => 'client_credentials']);

    $oauth->throw();
    $res = Http::withToken($oauth->json('access_token'))
        ->withHeaders(['Prefer' => 'return=representation'])
        ->post($base . '/v2/checkout/orders/' . urlencode($data['orderID']) . '/capture', new \stdClass());

    if ($res->failed()) {
        return response()->json($res->json(), $res->status());
    }

    return response()->json($res->json());
}
```

Persist `capture.id` and order status in your database for refunds and reconciliation.
