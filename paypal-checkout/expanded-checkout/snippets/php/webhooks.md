# Webhooks — Listener and Signature Verification (PHP + cURL)

Subscribe to events in the PayPal Developer Dashboard. Your endpoint receives **POST** requests with JSON bodies and verification headers. Confirm authenticity with **POST** `/v1/notifications/verify-webhook-signature`.

## PayPal API

**POST** `{base}/v1/notifications/verify-webhook-signature`

| Environment | Base URL |
|-------------|----------|
| Sandbox | `https://api-m.sandbox.paypal.com` |
| Production | `https://api-m.paypal.com` |

You need the **webhook ID** from the app’s webhook configuration.

## Environment variables

| Variable | Description |
|----------|-------------|
| `PAYPAL_WEBHOOK_ID` | Webhook ID from dashboard |
| `PAYPAL_CLIENT_ID` | Same REST app |
| `PAYPAL_CLIENT_SECRET` | Same REST app |

## Vanilla PHP — POST `/paypal-api/webhooks/paypal`

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
    curl_close($ch);
    $data = json_decode((string) $body, true, 512, JSON_THROW_ON_ERROR);
    return (string) ($data['access_token'] ?? '');
}

function paypal_header_first(array $headers, string $lowerName): string
{
    $v = $headers[$lowerName] ?? '';
    if (is_array($v)) {
        return (string) ($v[0] ?? '');
    }
    return (string) $v;
}

function paypal_verify_webhook_signature(
    string $base,
    string $accessToken,
    string $webhookId,
    array $headers,
    string $rawBody
): bool {
    $payload = [
        'transmission_id' => paypal_header_first($headers, 'paypal-transmission-id'),
        'transmission_time' => paypal_header_first($headers, 'paypal-transmission-time'),
        'cert_url' => paypal_header_first($headers, 'paypal-cert-url'),
        'auth_algo' => paypal_header_first($headers, 'paypal-auth-algo'),
        'transmission_sig' => paypal_header_first($headers, 'paypal-transmission-sig'),
        'webhook_id' => $webhookId,
        'webhook_event' => json_decode($rawBody, true, 512, JSON_THROW_ON_ERROR),
    ];

    $json = json_encode($payload, JSON_THROW_ON_ERROR | JSON_UNESCAPED_SLASHES);
    $ch = curl_init($base . '/v1/notifications/verify-webhook-signature');
    curl_setopt_array($ch, [
        CURLOPT_POST => true,
        CURLOPT_POSTFIELDS => $json,
        CURLOPT_HTTPHEADER => [
            'Authorization: Bearer ' . $accessToken,
            'Content-Type: application/json',
            'Accept: application/json',
        ],
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT => 30,
    ]);
    $resp = curl_exec($ch);
    $http = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    if ($http < 200 || $http >= 300 || !is_string($resp)) {
        return false;
    }
    $out = json_decode($resp, true, 512, JSON_THROW_ON_ERROR);
    return ($out['verification_status'] ?? '') === 'SUCCESS';
}

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
    http_response_code(405);
    exit;
}

$rawBody = file_get_contents('php://input') ?: '';
$headers = function_exists('getallheaders') ? getallheaders() : [];
$normalized = [];
foreach ($headers as $k => $v) {
    $normalized[strtolower((string) $k)] = is_array($v) ? $v : [$v];
}

$clientId = $_ENV['PAYPAL_CLIENT_ID'] ?? getenv('PAYPAL_CLIENT_ID') ?: '';
$secret = $_ENV['PAYPAL_CLIENT_SECRET'] ?? getenv('PAYPAL_CLIENT_SECRET') ?: '';
$webhookId = $_ENV['PAYPAL_WEBHOOK_ID'] ?? getenv('PAYPAL_WEBHOOK_ID') ?: '';

try {
    $base = paypal_base_url();
    $token = paypal_access_token($base, $clientId, $secret);
    $ok = paypal_verify_webhook_signature($base, $token, $webhookId, $normalized, $rawBody);
    if (!$ok) {
        http_response_code(400);
        echo json_encode(['error' => 'Invalid webhook signature']);
        exit;
    }

    $event = json_decode($rawBody, true, 512, JSON_THROW_ON_ERROR);
    $eventType = $event['event_type'] ?? '';

    switch ($eventType) {
        case 'PAYMENT.CAPTURE.COMPLETED':
            break;
        case 'PAYMENT.CAPTURE.DENIED':
            break;
        default:
            break;
    }

    http_response_code(200);
    echo json_encode(['received' => true]);
} catch (Throwable $e) {
    http_response_code(500);
    echo json_encode(['error' => $e->getMessage()]);
}
```

### nginx / FPM: headers without `getallheaders()`

```php
<?php
function paypal_webhook_headers_from_server(): array
{
    $out = [];
    foreach ($_SERVER as $key => $value) {
        if (str_starts_with($key, 'HTTP_')) {
            $name = strtolower(str_replace('_', '-', substr($key, 5)));
            $out[$name] = [$value];
        }
    }
    return $out;
}
```

## Laravel

```php
<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Http;

class PayPalWebhookController extends Controller
{
    public function __invoke(Request $request)
    {
        $base = config('services.paypal.environment') === 'production'
            ? 'https://api-m.paypal.com'
            : 'https://api-m.sandbox.paypal.com';

        $oauth = Http::asForm()
            ->withBasicAuth(config('services.paypal.client_id'), config('services.paypal.secret'))
            ->post($base . '/v1/oauth2/token', ['grant_type' => 'client_credentials']);

        $oauth->throw();

        $verify = Http::withToken($oauth->json('access_token'))
            ->post($base . '/v1/notifications/verify-webhook-signature', [
                'auth_algo' => $request->header('PAYPAL-AUTH-ALGO'),
                'cert_url' => $request->header('PAYPAL-CERT-URL'),
                'transmission_id' => $request->header('PAYPAL-TRANSMISSION-ID'),
                'transmission_sig' => $request->header('PAYPAL-TRANSMISSION-SIG'),
                'transmission_time' => $request->header('PAYPAL-TRANSMISSION-TIME'),
                'webhook_id' => config('services.paypal.webhook_id'),
                'webhook_event' => json_decode($request->getContent(), true, 512, JSON_THROW_ON_ERROR),
            ]);

        if (($verify->json('verification_status') ?? '') !== 'SUCCESS') {
            return response()->json(['error' => 'Invalid signature'], 400);
        }

        return response()->json(['received' => true]);
    }
}
```

Return **200** quickly after enqueueing work; persist **`event.id`** for idempotent processing. Expanded Checkout orders emit the same capture-related events as Standard Checkout once payments complete.

## Reference

- [Webhooks — developer.paypal.com](https://developer.paypal.com/api/rest/webhooks/)
