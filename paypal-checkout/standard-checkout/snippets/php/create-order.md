# Create Order — Server-Side

Your frontend calls **POST** `/paypal-api/checkout/orders/create`. Your PHP handler validates input, builds the Orders v2 payload, and calls PayPal with an **OAuth bearer** token.

## PayPal API

**POST** `{base}/v2/checkout/orders`

- **Sandbox:** `https://api-m.sandbox.paypal.com/v2/checkout/orders`
- **Production:** `https://api-m.paypal.com/v2/checkout/orders`

**Headers:** `Authorization: Bearer {access_token}`, `Content-Type: application/json`, `PayPal-Request-Id: {uuid}` (optional idempotency).

## Vanilla PHP — POST `/paypal-api/checkout/orders/create`

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
    $body = 'grant_type=client_credentials';
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
        CURLOPT_TIMEOUT => 30,
    ]);
    $responseBody = curl_exec($ch);
    $errno = curl_errno($ch);
    $errstr = curl_error($ch);
    $http = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    if ($errno !== 0 || !is_string($responseBody)) {
        throw new RuntimeException('OAuth cURL error: ' . $errstr);
    }
    if ($http < 200 || $http >= 300) {
        throw new RuntimeException('OAuth failed HTTP ' . $http . ': ' . $responseBody);
    }

    $data = json_decode($responseBody, true, 512, JSON_THROW_ON_ERROR);
    $token = $data['access_token'] ?? '';
    if ($token === '') {
        throw new RuntimeException('Missing access_token in OAuth response.');
    }
    return $token;
}

function read_json_body(): array
{
    $raw = file_get_contents('php://input');
    if ($raw === false || $raw === '') {
        return [];
    }
    return json_decode($raw, true, 512, JSON_THROW_ON_ERROR);
}

try {
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
        http_response_code(405);
        echo json_encode(['error' => 'Method not allowed']);
        exit;
    }

    $payload = read_json_body();

    $currency = strtoupper((string) ($payload['amount']['currency_code'] ?? ''));
    $value = (string) ($payload['amount']['value'] ?? '');
    if (!preg_match('/^[A-Z]{3}$/', $currency)) {
        http_response_code(400);
        echo json_encode(['error' => 'Invalid currency_code']);
        exit;
    }
    if (!preg_match('/^\d{1,10}(\.\d{1,2})?$/', $value)) {
        http_response_code(400);
        echo json_encode(['error' => 'Invalid amount value']);
        exit;
    }

    $clientId = $_ENV['PAYPAL_CLIENT_ID'] ?? getenv('PAYPAL_CLIENT_ID') ?: '';
    $secret = $_ENV['PAYPAL_CLIENT_SECRET'] ?? getenv('PAYPAL_CLIENT_SECRET') ?: '';
    if ($clientId === '' || $secret === '') {
        throw new RuntimeException('PayPal credentials missing');
    }

    $base = paypal_base_url();
    $accessToken = paypal_access_token($base, $clientId, $secret);

    $orderPayload = [
        'intent' => 'CAPTURE',
        'purchase_units' => [
            [
                'amount' => [
                    'currency_code' => $currency,
                    'value' => $value,
                ],
            ],
        ],
        'payment_source' => [
            'paypal' => [
                'experience_context' => [
                    'shipping_preference' => 'NO_SHIPPING',
                    'user_action' => 'PAY_NOW',
                ],
            ],
        ],
    ];

    $json = json_encode($orderPayload, JSON_THROW_ON_ERROR | JSON_UNESCAPED_SLASHES);
    $url = $base . '/v2/checkout/orders';

    $ch = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_POST => true,
        CURLOPT_POSTFIELDS => $json,
        CURLOPT_HTTPHEADER => [
            'Authorization: Bearer ' . $accessToken,
            'Content-Type: application/json',
            'Accept: application/json',
            'PayPal-Request-Id: ' . bin2hex(random_bytes(16)),
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
        throw new RuntimeException('Create order cURL error: ' . $errstr);
    }

    $responseHeaders = substr($rawResponse, 0, $headerSize);
    $responseBody = substr($rawResponse, $headerSize);
    $debugId = null;
    if (preg_match('/paypal-debug-id:\s*(\S+)/i', $responseHeaders, $m)) {
        $debugId = $m[1];
    }

    $decoded = json_decode($responseBody, true, 512, JSON_THROW_ON_ERROR);

    if ($http < 200 || $http >= 300) {
        http_response_code($http >= 400 && $http < 600 ? $http : 502);
        echo json_encode([
            'error' => $decoded['message'] ?? 'Create order failed',
            'details' => $decoded['details'] ?? null,
            'paypalDebugId' => $debugId,
        ], JSON_THROW_ON_ERROR);
        exit;
    }

    echo json_encode([
        'id' => $decoded['id'] ?? null,
        'status' => $decoded['status'] ?? null,
        'links' => $decoded['links'] ?? [],
    ], JSON_THROW_ON_ERROR);
} catch (Throwable $e) {
    http_response_code(500);
    echo json_encode(['error' => $e->getMessage()]);
}
```

## Optional: Laravel controller

```php
<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Str;

class PayPalOrderController extends Controller
{
    public function create(Request $request)
    {
        $validated = $request->validate([
            'amount.currency_code' => 'required|string|size:3',
            'amount.value' => 'required|string|regex:/^\d{1,10}(\.\d{1,2})?$/',
        ]);

        $base = config('services.paypal.environment') === 'production'
            ? 'https://api-m.paypal.com'
            : 'https://api-m.sandbox.paypal.com';

        $tokenRes = Http::asForm()
            ->withBasicAuth(config('services.paypal.client_id'), config('services.paypal.secret'))
            ->post($base . '/v1/oauth2/token', ['grant_type' => 'client_credentials']);

        $tokenRes->throw();
        $accessToken = $tokenRes->json('access_token');

        $orderRes = Http::withToken($accessToken)
            ->withHeaders(['PayPal-Request-Id' => (string) Str::uuid()])
            ->post($base . '/v2/checkout/orders', [
                'intent' => 'CAPTURE',
                'purchase_units' => [
                    [
                        'amount' => [
                            'currency_code' => strtoupper($validated['amount']['currency_code']),
                            'value' => $validated['amount']['value'],
                        ],
                    ],
                ],
                'payment_source' => [
                    'paypal' => [
                        'experience_context' => [
                            'shipping_preference' => 'NO_SHIPPING',
                            'user_action' => 'PAY_NOW',
                        ],
                    ],
                ],
            ]);

        if ($orderRes->failed()) {
            return response()->json($orderRes->json(), $orderRes->status());
        }

        return response()->json([
            'id' => $orderRes->json('id'),
            'status' => $orderRes->json('status'),
            'links' => $orderRes->json('links'),
        ]);
    }
}
```

Always **recompute totals server-side** from your cart or database; do not trust client-supplied amounts for production without cross-checking.
