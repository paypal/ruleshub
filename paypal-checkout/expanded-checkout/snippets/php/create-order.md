# Create Order — Expanded Checkout (PHP + cURL)

Create a PayPal order with **POST** `/v2/checkout/orders`. For **card** payments, use **`payment_source.card`** with **`experience_context`** (return/cancel URLs, shipping hints) and **`attributes.verification.method`** such as **`SCA_WHEN_REQUIRED`**.

Do **not** use the deprecated top-level **`application_context`**. For PayPal wallet flows, use **`payment_source.paypal.experience_context`**.

## PayPal API

**POST** `{base}/v2/checkout/orders`

| Environment | Base URL |
|-------------|----------|
| Sandbox | `https://api-m.sandbox.paypal.com` |
| Production | `https://api-m.paypal.com` |

**Headers:** `Authorization: Bearer {access_token}`, `Content-Type: application/json`, optional `PayPal-Request-Id` (idempotency).

## Card order payload (example)

```json
{
  "intent": "CAPTURE",
  "purchase_units": [
    {
      "amount": {
        "currency_code": "USD",
        "value": "50.00"
      }
    }
  ],
  "payment_source": {
    "card": {
      "experience_context": {
        "return_url": "https://yoursite.com/paypal/return",
        "cancel_url": "https://yoursite.com/paypal/cancel",
        "shipping_preference": "NO_SHIPPING"
      },
      "attributes": {
        "verification": {
          "method": "SCA_WHEN_REQUIRED"
        }
      }
    }
  }
}
```

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
    $errno = curl_errno($ch);
    curl_close($ch);
    if ($errno !== 0 || !is_string($body)) {
        throw new RuntimeException('OAuth cURL error');
    }
    $data = json_decode($body, true, 512, JSON_THROW_ON_ERROR);
    $token = (string) ($data['access_token'] ?? '');
    if ($token === '') {
        throw new RuntimeException('Missing access_token');
    }
    return $token;
}

try {
    if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
        http_response_code(405);
        echo json_encode(['error' => 'Method not allowed']);
        exit;
    }

    $raw = file_get_contents('php://input') ?: '';
    $payload = $raw === '' ? [] : json_decode($raw, true, 512, JSON_THROW_ON_ERROR);

    $currency = strtoupper((string) ($payload['amount']['currency_code'] ?? ''));
    $value = (string) ($payload['amount']['value'] ?? '');
    $returnUrl = (string) ($payload['return_url'] ?? 'https://example.com/return');
    $cancelUrl = (string) ($payload['cancel_url'] ?? 'https://example.com/cancel');

    if (!preg_match('/^[A-Z]{3}$/', $currency)) {
        http_response_code(400);
        echo json_encode(['error' => 'Invalid currency_code']);
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
            'card' => [
                'experience_context' => [
                    'return_url' => $returnUrl,
                    'cancel_url' => $cancelUrl,
                    'shipping_preference' => 'NO_SHIPPING',
                ],
                'attributes' => [
                    'verification' => [
                        'method' => 'SCA_WHEN_REQUIRED',
                    ],
                ],
            ],
        ],
    ];

    $json = json_encode($orderPayload, JSON_THROW_ON_ERROR | JSON_UNESCAPED_SLASHES);
    $ch = curl_init($base . '/v2/checkout/orders');
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
    $http = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $headerSize = (int) curl_getinfo($ch, CURLINFO_HEADER_SIZE);
    curl_close($ch);

    if (!is_string($rawResponse)) {
        throw new RuntimeException('Create order cURL failed');
    }
    $responseBody = substr($rawResponse, $headerSize);
    $decoded = json_decode($responseBody, true, 512, JSON_THROW_ON_ERROR);

    if ($http < 200 || $http >= 300) {
        http_response_code($http >= 400 && $http < 600 ? $http : 502);
        echo json_encode([
            'error' => $decoded['message'] ?? 'Create order failed',
            'details' => $decoded['details'] ?? null,
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

## PayPal wallet (same order API, different `payment_source`)

If the buyer pays with the **PayPal button**, use **`payment_source.paypal.experience_context`** — still **not** top-level `application_context`:

```php
'payment_source' => [
    'paypal' => [
        'experience_context' => [
            'payment_method_preference' => 'IMMEDIATE_PAYMENT_REQUIRED',
            'shipping_preference' => 'NO_SHIPPING',
            'user_action' => 'PAY_NOW',
        ],
    ],
],
```

## Laravel — `Http::` facade

```php
<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Str;

class PayPalExpandedOrderController extends Controller
{
    public function create(Request $request)
    {
        $validated = $request->validate([
            'amount.currency_code' => 'required|string|size:3',
            'amount.value' => 'required|string',
            'return_url' => 'nullable|url',
            'cancel_url' => 'nullable|url',
        ]);

        $base = config('services.paypal.environment') === 'production'
            ? 'https://api-m.paypal.com'
            : 'https://api-m.sandbox.paypal.com';

        $oauth = Http::asForm()
            ->withBasicAuth(config('services.paypal.client_id'), config('services.paypal.secret'))
            ->post($base . '/v1/oauth2/token', ['grant_type' => 'client_credentials']);

        $oauth->throw();

        $order = Http::withToken($oauth->json('access_token'))
            ->withHeaders(['PayPal-Request-Id' => (string) Str::uuid()])
            ->post($base . '/v2/checkout/orders', [
                'intent' => 'CAPTURE',
                'purchase_units' => [[
                    'amount' => [
                        'currency_code' => strtoupper($validated['amount']['currency_code']),
                        'value' => $validated['amount']['value'],
                    ],
                ]],
                'payment_source' => [
                    'card' => [
                        'experience_context' => [
                            'return_url' => $validated['return_url'] ?? url('/paypal/return'),
                            'cancel_url' => $validated['cancel_url'] ?? url('/paypal/cancel'),
                            'shipping_preference' => 'NO_SHIPPING',
                        ],
                        'attributes' => [
                            'verification' => ['method' => 'SCA_WHEN_REQUIRED'],
                        ],
                    ],
                ],
            ]);

        if ($order->failed()) {
            return response()->json($order->json(), $order->status());
        }

        return response()->json([
            'id' => $order->json('id'),
            'status' => $order->json('status'),
            'links' => $order->json('links'),
        ]);
    }
}
```

Recompute **amounts** from your cart or database on the server before creating the order.
