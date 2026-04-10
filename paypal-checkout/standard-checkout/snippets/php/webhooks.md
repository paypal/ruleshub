# Webhooks — Listener and Signature Verification

Subscribe to events in the PayPal Developer Dashboard. Your endpoint receives **POST** requests with JSON bodies and **headers** used for verification. Verify with **POST** `/v1/notifications/verify-webhook-signature`.

## PayPal API

**POST** `{base}/v1/notifications/verify-webhook-signature`

- **Sandbox:** `https://api-m.sandbox.paypal.com/v1/notifications/verify-webhook-signature`
- **Production:** `https://api-m.paypal.com/v1/notifications/verify-webhook-signature`

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

/**
 * Read a header value; $headers keys must be lowercase (e.g. paypal-transmission-id).
 */
function paypal_header_first(array $headers, string $lowerName): string
{
    $v = $headers[$lowerName] ?? '';
    if (is_array($v)) {
        return (string) ($v[0] ?? '');
    }
    return (string) $v;
}

/**
 * Verify webhook signature (call before processing event body).
 */
function paypal_verify_webhook_signature(
    string $base,
    string $accessToken,
    string $webhookId,
    array $headers,
    string $rawBody
): bool {
    $transmissionId = paypal_header_first($headers, 'paypal-transmission-id');
    $time = paypal_header_first($headers, 'paypal-transmission-time');
    $sig = paypal_header_first($headers, 'paypal-transmission-sig');
    $certUrl = paypal_header_first($headers, 'paypal-cert-url');
    $authAlgo = paypal_header_first($headers, 'paypal-auth-algo');

    $payload = [
        'transmission_id' => $transmissionId,
        'transmission_time' => $time,
        'cert_url' => $certUrl,
        'auth_algo' => $authAlgo,
        'transmission_sig' => $sig,
        'webhook_id' => $webhookId,
        'webhook_event' => json_decode($rawBody, true, 512, JSON_THROW_ON_ERROR),
    ];

    $json = json_encode($payload, JSON_THROW_ON_ERROR | JSON_UNESCAPED_SLASHES);
    $url = $base . '/v1/notifications/verify-webhook-signature';

    $ch = curl_init($url);
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

// --- Webhook endpoint ---
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    exit;
}

$rawBody = file_get_contents('php://input') ?: '';
$headers = getallheaders();

// Normalize header keys to lowercase for lookup
$normalized = [];
foreach ($headers as $k => $v) {
    $normalized[strtolower($k)] = is_array($v) ? $v : [$v];
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

    // Idempotent handling: use resource id + event id stored in DB
    switch ($eventType) {
        case 'PAYMENT.CAPTURE.COMPLETED':
            // Update order paid status
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

**Note:** `getallheaders()` may be unavailable in CLI; under Apache it works. For FPM/nginx, use `$_SERVER` keys (`HTTP_PAYPAL_TRANSMISSION_ID`, etc.).

### Header fallback without `getallheaders()`

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

## Optional: Laravel

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

        // Process $request->all() idempotently
        return response()->json(['received' => true]);
    }
}
```

Return **200** quickly after enqueueing work; use queues for heavy processing. Store `event.id` to deduplicate deliveries.
