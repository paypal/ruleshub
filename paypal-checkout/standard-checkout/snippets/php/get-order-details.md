# Get Order Details — Server-Side

Use **GET** `/v2/checkout/orders/{order_id}` to inspect an order before capture, after approval, or for support tooling.

## PayPal API

**GET** `{base}/v2/checkout/orders/{order_id}`

- **Sandbox:** `https://api-m.sandbox.paypal.com/v2/checkout/orders/{id}`
- **Production:** `https://api-m.paypal.com/v2/checkout/orders/{id}`

Optional query: `fields` (e.g. `payment_source`).

## Vanilla PHP — GET `/paypal-api/checkout/orders/{order_id}`

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
        throw new RuntimeException('OAuth HTTP ' . $http);
    }
    $data = json_decode($body, true, 512, JSON_THROW_ON_ERROR);
    return (string) ($data['access_token'] ?? '');
}

try {
    if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
        http_response_code(405);
        echo json_encode(['error' => 'Method not allowed']);
        exit;
    }

    $path = $_SERVER['REQUEST_URI'] ?? '';
    $orderId = $_GET['order_id'] ?? '';
    if ($orderId === '' && preg_match('#/orders/([^/?]+)#', $path, $m)) {
        $orderId = $m[1];
    }
    if ($orderId === '' || !preg_match('/^[A-Z0-9-]+$/', $orderId)) {
        http_response_code(400);
        echo json_encode(['error' => 'Invalid order_id']);
        exit;
    }

    $clientId = $_ENV['PAYPAL_CLIENT_ID'] ?? getenv('PAYPAL_CLIENT_ID') ?: '';
    $secret = $_ENV['PAYPAL_CLIENT_SECRET'] ?? getenv('PAYPAL_CLIENT_SECRET') ?: '';
    if ($clientId === '' || $secret === '') {
        throw new RuntimeException('PayPal credentials missing');
    }

    $base = paypal_base_url();
    $token = paypal_access_token($base, $clientId, $secret);
    $url = $base . '/v2/checkout/orders/' . rawurlencode($orderId);

    $ch = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_HTTPGET => true,
        CURLOPT_HTTPHEADER => [
            'Authorization: Bearer ' . $token,
            'Accept: application/json',
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
        throw new RuntimeException('GET order cURL error: ' . $errstr);
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
            'error' => $decoded['message'] ?? 'Get order failed',
            'paypalDebugId' => $debugId,
        ], JSON_THROW_ON_ERROR);
        exit;
    }

    echo json_encode([
        'order' => $decoded,
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

use Illuminate\Support\Facades\Http;

Route::get('/paypal-api/checkout/orders/{orderId}', function (string $orderId) {
    if (!preg_match('/^[A-Z0-9-]+$/', $orderId)) {
        abort(400, 'Invalid order id');
    }

    $base = config('services.paypal.environment') === 'production'
        ? 'https://api-m.paypal.com'
        : 'https://api-m.sandbox.paypal.com';

    $oauth = Http::asForm()
        ->withBasicAuth(config('services.paypal.client_id'), config('services.paypal.secret'))
        ->post($base . '/v1/oauth2/token', ['grant_type' => 'client_credentials']);

    $oauth->throw();

    $res = Http::withToken($oauth->json('access_token'))
        ->get($base . '/v2/checkout/orders/' . rawurlencode($orderId));

    return response()->json($res->json(), $res->status());
});
```

Use the response to verify `status` (for example `APPROVED` before capture) and `purchase_units[].amount` against your records.
