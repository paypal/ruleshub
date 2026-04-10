# Refund Payment — Server-Side

Refunds target a **capture ID** (from the capture response or GET order). Use **Payments API v2** — **POST** `/v2/payments/captures/{capture_id}/refund`.

## PayPal API

**POST** `{base}/v2/payments/captures/{capture_id}/refund`

- **Sandbox:** `https://api-m.sandbox.paypal.com`
- **Production:** `https://api-m.paypal.com`

**Full refund:** send `{}` or omit amount (per current API behavior).  
**Partial refund:** include `amount` with `currency_code` and `value`.

## Vanilla PHP — Full refund

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

function paypal_access_token(string $base, string $clientId, string $secret): string
{
    $ch = curl_init($base . '/v1/oauth2/token');
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
    curl_close($ch);
    if ($errno !== 0 || !is_string($body)) {
        throw new RuntimeException('OAuth: ' . $errstr);
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

    $in = json_decode(file_get_contents('php://input') ?: '{}', true, 512, JSON_THROW_ON_ERROR);
    $captureId = (string) ($in['capture_id'] ?? '');
    if ($captureId === '' || !preg_match('/^[A-Z0-9]+$/', $captureId)) {
        http_response_code(400);
        echo json_encode(['error' => 'Invalid capture_id']);
        exit;
    }

    $clientId = $_ENV['PAYPAL_CLIENT_ID'] ?? getenv('PAYPAL_CLIENT_ID') ?: '';
    $secret = $_ENV['PAYPAL_CLIENT_SECRET'] ?? getenv('PAYPAL_CLIENT_SECRET') ?: '';
    $base = paypal_base_url();
    $token = paypal_access_token($base, $clientId, $secret);

    $url = $base . '/v2/payments/captures/' . rawurlencode($captureId) . '/refund';
    $payload = '{}';

    $ch = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_POST => true,
        CURLOPT_POSTFIELDS => $payload,
        CURLOPT_HTTPHEADER => [
            'Authorization: Bearer ' . $token,
            'Content-Type: application/json',
            'Accept: application/json',
            'PayPal-Request-Id: ' . bin2hex(random_bytes(16)),
        ],
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_HEADER => true,
        CURLOPT_TIMEOUT => 30,
    ]);
    $raw = curl_exec($ch);
    $errno = curl_errno($ch);
    $errstr = curl_error($ch);
    $http = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $headerSize = (int) curl_getinfo($ch, CURLINFO_HEADER_SIZE);
    curl_close($ch);

    if ($errno !== 0 || !is_string($raw)) {
        throw new RuntimeException('Refund cURL: ' . $errstr);
    }

    $headers = substr($raw, 0, $headerSize);
    $body = substr($raw, $headerSize);
    $debugId = null;
    if (preg_match('/paypal-debug-id:\s*(\S+)/i', $headers, $m)) {
        $debugId = $m[1];
    }

    $decoded = json_decode($body, true, 512, JSON_THROW_ON_ERROR);
    if ($http < 200 || $http >= 300) {
        http_response_code($http >= 400 && $http < 600 ? $http : 502);
        echo json_encode([
            'error' => $decoded['message'] ?? 'Refund failed',
            'paypalDebugId' => $debugId,
        ], JSON_THROW_ON_ERROR);
        exit;
    }

    echo json_encode([
        'refundId' => $decoded['id'] ?? null,
        'status' => $decoded['status'] ?? null,
        'paypalDebugId' => $debugId,
    ], JSON_THROW_ON_ERROR);
} catch (Throwable $e) {
    http_response_code(500);
    echo json_encode(['error' => $e->getMessage()]);
}
```

## Vanilla PHP — Partial refund

```php
<?php
declare(strict_types=1);

$partial = [
    'amount' => [
        'currency_code' => 'USD',
        'value' => '5.00',
    ],
];
$json = json_encode($partial, JSON_THROW_ON_ERROR);

// POST $base . '/v2/payments/captures/' . rawurlencode($captureId) . '/refund'
// CURLOPT_POSTFIELDS => $json
```

## Optional: Laravel

```php
<?php

use Illuminate\Support\Facades\Http;
use Illuminate\Support\Str;

public function refund(Request $request)
{
    $data = $request->validate([
        'capture_id' => 'required|string',
        'amount.value' => 'nullable|string',
        'amount.currency_code' => 'nullable|string|size:3',
    ]);

    $base = config('services.paypal.environment') === 'production'
        ? 'https://api-m.paypal.com'
        : 'https://api-m.sandbox.paypal.com';

    $oauth = Http::asForm()
        ->withBasicAuth(config('services.paypal.client_id'), config('services.paypal.secret'))
        ->post($base . '/v1/oauth2/token', ['grant_type' => 'client_credentials']);

    $oauth->throw();

    $body = [];
    if (!empty($data['amount']['value'])) {
        $body['amount'] = [
            'currency_code' => strtoupper($data['amount']['currency_code']),
            'value' => $data['amount']['value'],
        ];
    }

    $res = Http::withToken($oauth->json('access_token'))
        ->withHeaders(['PayPal-Request-Id' => (string) Str::uuid()])
        ->post($base . '/v2/payments/captures/' . rawurlencode($data['capture_id']) . '/refund', $body);

    return response()->json($res->json(), $res->status());
}
```

Store `refund.id` and status for support and accounting. Idempotency: use a stable `PayPal-Request-Id` per logical refund attempt if you retry.
