# Capture Order — Expanded Checkout (PHP + cURL)

After the buyer approves (Card Fields / 3DS completes as needed), capture funds with **POST** `/v2/checkout/orders/{order_id}/capture`. Inspect the response for **card** details such as **`liability_shift`** and **`authentication_result`** when present.

## PayPal API

**POST** `{base}/v2/checkout/orders/{order_id}/capture`

| Environment | Base URL |
|-------------|----------|
| Sandbox | `https://api-m.sandbox.paypal.com` |
| Production | `https://api-m.paypal.com` |

## Card-related response fields (examples)

Paths vary by API version and payment instruments; commonly look under:

- `purchase_units[0].payments.captures[0].seller_protection`
- Card-specific nested objects for **3DS** / **liability** (see PayPal Orders v2 schema for your integration)

Use **`paypal-debug-id`** from response headers when contacting support.

## Vanilla PHP — POST `/paypal-api/checkout/orders/{id}/capture`

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
    $ch = curl_init($baseUrl . '/v1/oauth2/token');
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
 * Extract liability_shift / authentication hints from capture response (best-effort).
 */
function paypal_card_liability_hints(array $order): array
{
    $out = ['liability_shift' => null, 'raw_paths' => []];
    $units = $order['purchase_units'] ?? [];
    foreach ($units as $pu) {
        $payments = $pu['payments'] ?? [];
        foreach (($payments['captures'] ?? []) as $cap) {
            if (isset($cap['seller_protection'])) {
                $out['seller_protection'] = $cap['seller_protection'];
            }
        }
    }
    return $out;
}

try {
    if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
        http_response_code(405);
        echo json_encode(['error' => 'Method not allowed']);
        exit;
    }

    $path = $_SERVER['REQUEST_URI'] ?? '';
    if (!preg_match('#/orders/([^/]+)/capture#', $path, $m)) {
        http_response_code(400);
        echo json_encode(['error' => 'Missing order id']);
        exit;
    }
    $orderId = $m[1];

    $clientId = $_ENV['PAYPAL_CLIENT_ID'] ?? getenv('PAYPAL_CLIENT_ID') ?: '';
    $secret = $_ENV['PAYPAL_CLIENT_SECRET'] ?? getenv('PAYPAL_CLIENT_SECRET') ?: '';
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
            'PayPal-Request-Id: ' . bin2hex(random_bytes(16)),
        ],
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_HEADER => true,
        CURLOPT_TIMEOUT => 30,
    ]);
    $raw = curl_exec($ch);
    $http = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $headerSize = (int) curl_getinfo($ch, CURLINFO_HEADER_SIZE);
    curl_close($ch);

    if (!is_string($raw)) {
        throw new RuntimeException('Capture cURL failed');
    }
    $headers = substr($raw, 0, $headerSize);
    $body = substr($raw, $headerSize);
    $debugId = null;
    if (preg_match('/paypal-debug-id:\s*(\S+)/i', $headers, $hm)) {
        $debugId = $hm[1];
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

    $hints = paypal_card_liability_hints($decoded);

    echo json_encode([
        'id' => $decoded['id'] ?? null,
        'status' => $decoded['status'] ?? null,
        'purchase_units' => $decoded['purchase_units'] ?? [],
        'card_hints' => $hints,
        'paypalDebugId' => $debugId,
    ], JSON_THROW_ON_ERROR);
} catch (Throwable $e) {
    http_response_code(500);
    echo json_encode(['error' => $e->getMessage()]);
}
```

## Interpreting `liability_shift`

- Values and nesting depend on the **card network** and **3DS outcome**.
- Map outcomes to your **risk** and **fulfillment** policies; log full sandbox responses once to see exact keys.

## Laravel

```php
<?php

namespace App\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Str;

class PayPalCaptureController extends Controller
{
    public function capture(Request $request, string $orderId): JsonResponse
    {
        $base = config('services.paypal.environment') === 'production'
            ? 'https://api-m.paypal.com'
            : 'https://api-m.sandbox.paypal.com';

        $oauth = Http::asForm()
            ->withBasicAuth(config('services.paypal.client_id'), config('services.paypal.secret'))
            ->post($base . '/v1/oauth2/token', ['grant_type' => 'client_credentials']);

        $oauth->throw();

        $res = Http::withToken($oauth->json('access_token'))
            ->withHeaders(['PayPal-Request-Id' => (string) Str::uuid()])
            ->post($base . '/v2/checkout/orders/' . rawurlencode($orderId) . '/capture', new \stdClass());

        if ($res->failed()) {
            return response()->json($res->json(), $res->status());
        }

        return response()->json($res->json());
    }
}
```

Return **201** semantics match PayPal’s response; your route can pass through status or normalize to **200** for SPA clients.
