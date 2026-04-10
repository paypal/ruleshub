# Authorize Order (Delayed Capture) — Server-Side

For **authorize now, capture later**, create the order with **`intent`: `AUTHORIZE`**, then call **authorize** after buyer approval, and **capture** when you ship or fulfill.

## Flow

1. **Create order** — `intent`: `AUTHORIZE` (not `CAPTURE`).
2. Buyer approves — order status becomes `APPROVED`.
3. **Authorize** — **POST** `/v2/checkout/orders/{order_id}/authorize` (places hold on funds).
4. Later — **POST** `/v2/payments/authorizations/{authorization_id}/capture` to capture all or part of the authorized amount.

## PayPal APIs

| Step | Method | Path |
|------|--------|------|
| Authorize | POST | `{base}/v2/checkout/orders/{order_id}/authorize` |
| Capture auth | POST | `{base}/v2/payments/authorizations/{authorization_id}/capture` |

**Base URLs**

- **Sandbox:** `https://api-m.sandbox.paypal.com`
- **Production:** `https://api-m.paypal.com`

## Create order (AUTHORIZE intent) — payload excerpt

```php
<?php
$orderPayload = [
    'intent' => 'AUTHORIZE',
    'purchase_units' => [
        [
            'amount' => [
                'currency_code' => 'USD',
                'value' => '25.00',
            ],
        ],
    ],
];
$json = json_encode($orderPayload, JSON_THROW_ON_ERROR);
// POST $base . '/v2/checkout/orders' with Bearer token (same as CAPTURE flow)
```

## Vanilla PHP — Authorize after approval

```php
<?php
declare(strict_types=1);

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
 * POST /v2/checkout/orders/{order_id}/authorize
 */
function paypal_authorize_order(string $orderId): array
{
    $base = paypal_base_url();
    $clientId = $_ENV['PAYPAL_CLIENT_ID'] ?? getenv('PAYPAL_CLIENT_ID') ?: '';
    $secret = $_ENV['PAYPAL_CLIENT_SECRET'] ?? getenv('PAYPAL_CLIENT_SECRET') ?: '';
    $token = paypal_access_token($base, $clientId, $secret);

    $url = $base . '/v2/checkout/orders/' . rawurlencode($orderId) . '/authorize';
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
        CURLOPT_TIMEOUT => 30,
    ]);
    $body = curl_exec($ch);
    $http = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    $decoded = json_decode((string) $body, true, 512, JSON_THROW_ON_ERROR);
    if ($http < 200 || $http >= 300) {
        throw new RuntimeException($decoded['message'] ?? 'Authorize failed');
    }

    return $decoded;
}

// Example: extract authorization id for later capture
// $authId = $response['purchase_units'][0]['payments']['authorizations'][0]['id'] ?? null;
```

## Vanilla PHP — Capture an authorization

```php
<?php
declare(strict_types=1);

// Reuse paypal_base_url() and paypal_access_token() from the authorize example above.

function paypal_capture_authorization(string $authorizationId, ?string $amountValue = null, ?string $currency = null): array
{
    $base = paypal_base_url();
    $clientId = $_ENV['PAYPAL_CLIENT_ID'] ?? getenv('PAYPAL_CLIENT_ID') ?: '';
    $secret = $_ENV['PAYPAL_CLIENT_SECRET'] ?? getenv('PAYPAL_CLIENT_SECRET') ?: '';
    $token = paypal_access_token($base, $clientId, $secret);

    $payload = new stdClass();
    if ($amountValue !== null && $currency !== null) {
        $payload = [
            'amount' => [
                'currency_code' => $currency,
                'value' => $amountValue,
            ],
            'final_capture' => true,
        ];
    }

    $url = $base . '/v2/payments/authorizations/' . rawurlencode($authorizationId) . '/capture';
    $ch = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_POST => true,
        CURLOPT_POSTFIELDS => json_encode($payload, JSON_THROW_ON_ERROR),
        CURLOPT_HTTPHEADER => [
            'Authorization: Bearer ' . $token,
            'Content-Type: application/json',
            'Accept: application/json',
        ],
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT => 30,
    ]);
    $body = curl_exec($ch);
    $http = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    $decoded = json_decode((string) $body, true, 512, JSON_THROW_ON_ERROR);
    if ($http < 200 || $http >= 300) {
        throw new RuntimeException($decoded['message'] ?? 'Capture authorization failed');
    }
    return $decoded;
}
```

## Frontend note (JS SDK)

Use the same `createOrder` / `onApprove` flow as capture. On approve, call your **authorize** endpoint instead of **capture** if you use delayed capture. Your `createOrder` server handler must use `intent: AUTHORIZE`.

## Optional: Laravel

```php
<?php

public function authorizeOrder(string $orderId)
{
    $base = config('services.paypal.environment') === 'production'
        ? 'https://api-m.paypal.com'
        : 'https://api-m.sandbox.paypal.com';

    $oauth = Http::asForm()
        ->withBasicAuth(config('services.paypal.client_id'), config('services.paypal.secret'))
        ->post($base . '/v1/oauth2/token', ['grant_type' => 'client_credentials']);

    $oauth->throw();

    return Http::withToken($oauth->json('access_token'))
        ->withHeaders(['Prefer' => 'return=representation'])
        ->post($base . '/v2/checkout/orders/' . rawurlencode($orderId) . '/authorize', new \stdClass());
}
```

Respect PayPal’s authorization validity window; capture or reauthorize before expiry per [delayed capture](https://docs.paypal.ai/payments/methods/paypal/delayed-capture) documentation.
