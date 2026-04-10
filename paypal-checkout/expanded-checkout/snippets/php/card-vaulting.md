# Card Vaulting — Setup Tokens & Payment Tokens (PHP + cURL)

Save cards for later using the **Vault v3** APIs. Typical flow: create a **setup token**, complete buyer consent in the **JS SDK**, then exchange for a **payment token** server-side. Base URLs match REST:

| Environment | Base URL |
|-------------|----------|
| Sandbox | `https://api-m.sandbox.paypal.com` |
| Production | `https://api-m.paypal.com` |

## Endpoints

| Action | Method | Path |
|--------|--------|------|
| Create setup token | POST | `/v3/vault/setup-tokens` |
| Create payment token | POST | `/v3/vault/payment-tokens` |

Use **OAuth bearer** from **`grant_type=client_credentials`** (not the browser client token).

## Vanilla PHP — create setup token

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

function paypal_post_json(string $base, string $path, string $token, array $payload): array
{
    $json = json_encode($payload, JSON_THROW_ON_ERROR | JSON_UNESCAPED_SLASHES);
    $ch = curl_init($base . $path);
    curl_setopt_array($ch, [
        CURLOPT_POST => true,
        CURLOPT_POSTFIELDS => $json,
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
        throw new RuntimeException('Vault request failed');
    }
    $body = substr($raw, $headerSize);
    $decoded = json_decode($body, true, 512, JSON_THROW_ON_ERROR);
    if ($http < 200 || $http >= 300) {
        throw new RuntimeException('Vault HTTP ' . $http . ': ' . $body);
    }
    return $decoded;
}

// Example: create setup token (shape per Vault v3 docs — adjust fields to your integration)
$base = paypal_base_url();
$clientId = $_ENV['PAYPAL_CLIENT_ID'] ?? getenv('PAYPAL_CLIENT_ID') ?: '';
$secret = $_ENV['PAYPAL_CLIENT_SECRET'] ?? getenv('PAYPAL_CLIENT_SECRET') ?: '';
$token = paypal_access_token($base, $clientId, $secret);

$setupBody = [
    'payment_source' => [
        'card' => [
            'attributes' => [
                'vault' => [
                    'store_in_vault' => 'ON_SUCCESS',
                    'usage_pattern' => 'IMMEDIATE',
                    'usage_type' => 'MERCHANT',
                ],
            ],
        ],
    ],
];

$setup = paypal_post_json($base, '/v3/vault/setup-tokens', $token, $setupBody);
// Return setup token id / approval URL to client — client completes vault consent via JS SDK
```

## Exchange setup token for payment token

After the JS flow completes and you receive the **`setup_token_id`** (or equivalent) from the client, call **POST** `/v3/vault/payment-tokens` with the body required by current Vault v3 documentation.

```php
$paymentTokenBody = [
    'payment_source' => [
        'token' => [
            'id' => 'SETUP_TOKEN_FROM_CLIENT',
            'type' => 'SETUP_TOKEN',
        ],
    ],
];

$paymentToken = paypal_post_json($base, '/v3/vault/payment-tokens', $token, $paymentTokenBody);
// Persist payment_token id server-side; associate with your customer id
```

## Laravel

```php
<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Str;

class PayPalVaultController extends Controller
{
    public function setupToken(Request $request)
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
            ->post($base . '/v3/vault/setup-tokens', $request->all());

        return response()->json($res->json(), $res->status());
    }
}
```

## References

- [Vault API integration (docs.paypal.ai)](https://docs.paypal.ai/payments/save/api/vault-api-integration)
- [Save cards with purchase (JS SDK v6)](https://docs.paypal.ai/payments/save/sdk/cards/js-sdk-v6-vault)

Payload fields (`store_in_vault`, `usage_type`, etc.) must match **current** Vault v3 schemas for your product and region.
