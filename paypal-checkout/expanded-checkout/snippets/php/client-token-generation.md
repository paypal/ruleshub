# Client Token Generation — Expanded Checkout (PHP + cURL)

For **JS SDK v5/v6** with Card Fields, the browser needs a **browser-safe client token** from your server. Request it with OAuth using **`response_type=client_token`** and **`intent=sdk_init`**.

Never expose `PAYPAL_CLIENT_SECRET` in frontend code.

## API

**POST** `{base}/v1/oauth2/token`

| Environment | Base URL |
|-------------|----------|
| Sandbox | `https://api-m.sandbox.paypal.com` |
| Production | `https://api-m.paypal.com` |

**Body** (URL-encoded):

```
grant_type=client_credentials&response_type=client_token&intent=sdk_init
```

**Authorization:** `Basic base64(PAYPAL_CLIENT_ID:PAYPAL_CLIENT_SECRET)`

## Vanilla PHP — GET `/paypal-api/auth/browser-safe-client-token`

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

/**
 * Browser-safe token for JS SDK init (Expanded Checkout / Card Fields).
 */
function paypal_client_token_for_sdk_init(string $baseUrl, string $clientId, string $secret): array
{
    $url = $baseUrl . '/v1/oauth2/token';
    $body = 'grant_type=client_credentials&response_type=client_token&intent=sdk_init';
    $auth = base64_encode($clientId . ':' . $secret);

    $ch = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_POST => true,
        CURLOPT_POSTFIELDS => $body,
        CURLOPT_HTTPHEADER => [
            'Authorization: Basic ' . $auth,
            'Content-Type: application/x-www-form-urlencoded',
            'Accept: application/json',
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
        throw new RuntimeException('Client token cURL error: ' . $errstr);
    }

    $headers = substr($raw, 0, $headerSize);
    $responseBody = substr($raw, $headerSize);
    $debugId = null;
    if (preg_match('/paypal-debug-id:\s*(\S+)/i', $headers, $m)) {
        $debugId = $m[1];
    }

    $data = json_decode($responseBody, true, 512, JSON_THROW_ON_ERROR);

    if ($http < 200 || $http >= 300) {
        throw new RuntimeException(
            'Client token failed HTTP ' . $http . ': ' . $responseBody . ' debugId=' . ($debugId ?? '')
        );
    }

    $token = (string) ($data['access_token'] ?? '');
    if ($token === '') {
        throw new RuntimeException('Missing access_token in client token response.');
    }

    return [
        'access_token' => $token,
        'expires_in' => (int) ($data['expires_in'] ?? 0),
        'paypal_debug_id' => $debugId,
    ];
}

// Simple endpoint (add caching in production — see below)
if (($_SERVER['REQUEST_METHOD'] ?? '') === 'GET' && str_ends_with($_SERVER['REQUEST_URI'] ?? '', '/browser-safe-client-token')) {
    try {
        $clientId = $_ENV['PAYPAL_CLIENT_ID'] ?? getenv('PAYPAL_CLIENT_ID') ?: '';
        $secret = $_ENV['PAYPAL_CLIENT_SECRET'] ?? getenv('PAYPAL_CLIENT_SECRET') ?: '';
        if ($clientId === '' || $secret === '') {
            throw new RuntimeException('PayPal credentials missing');
        }
        $base = paypal_base_url();
        $out = paypal_client_token_for_sdk_init($base, $clientId, $secret);
        echo json_encode([
            'accessToken' => $out['access_token'],
            'expiresIn' => $out['expires_in'],
        ], JSON_THROW_ON_ERROR);
    } catch (Throwable $e) {
        http_response_code(500);
        echo json_encode(['error' => $e->getMessage()]);
    }
    exit;
}
```

## Caching

Cache the token until shortly before `expires_in` (for example, a 60–120 second buffer). For multiple PHP workers, use **Redis** or similar — not only static in-memory cache in `php-fpm` unless you accept per-worker duplication.

## Laravel — route or controller

```php
<?php

namespace App\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;

class PayPalClientTokenController extends Controller
{
    public function __invoke(): JsonResponse
    {
        $base = config('services.paypal.environment') === 'production'
            ? 'https://api-m.paypal.com'
            : 'https://api-m.sandbox.paypal.com';

        $cacheKey = 'paypal:sdk_client_token';

        $payload = Cache::remember($cacheKey, now()->addMinutes(8), function () use ($base) {
            $res = Http::asForm()
                ->withBasicAuth(config('services.paypal.client_id'), config('services.paypal.secret'))
                ->post($base . '/v1/oauth2/token', [
                    'grant_type' => 'client_credentials',
                    'response_type' => 'client_token',
                    'intent' => 'sdk_init',
                ]);

            $res->throw();

            return [
                'accessToken' => $res->json('access_token'),
                'expiresIn' => (int) $res->json('expires_in', 0),
            ];
        });

        return response()->json($payload);
    }
}
```

After the client receives the token, initialize the SDK with **`card-fields`** (v5 script `components=buttons,card-fields` or v6 `components: ['paypal-payments', 'card-fields']`). See `sdk-initialization.md`.

## Common issues

| Issue | Fix |
|-------|-----|
| `invalid_client` | Sandbox vs live mismatch; wrong Client ID/secret |
| Card Fields missing in UI | Token OK but SDK missing `card-fields` component |
| Rate limits | Cache token; avoid per-request OAuth storms |
