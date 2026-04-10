# Seller onboarding — `POST /v2/customer/partner-referrals` (cURL + Laravel)

Create a seller onboarding link with **`POST /v2/customer/partner-referrals`**. After the seller finishes PayPal, check status with **`GET /v1/customer/partners/{partner_id}/merchant-integrations/{merchant_id}`**.

REST bases:

| Environment | Base URL |
|-------------|----------|
| Sandbox | `https://api-m.sandbox.paypal.com` |
| Production | `https://api-m.paypal.com` |

## OAuth — client credentials

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
    $code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    if ($body === false || $code < 200 || $code >= 300) {
        throw new RuntimeException('OAuth token request failed: HTTP ' . $code);
    }
    $json = json_decode($body, true, 512, JSON_THROW_ON_ERROR);

    return $json['access_token'];
}
```

## `POST /v2/customer/partner-referrals` — cURL

```php
<?php
declare(strict_types=1);

function create_partner_referral(
    string $accessToken,
    string $trackingId,
    string $returnUrl,
    string $baseUrl
): array {
    $payload = [
        'tracking_id' => $trackingId,
        'partner_config_override' => [
            'return_url' => $returnUrl,
        ],
        'operations' => [
            [
                'operation' => 'API_INTEGRATION',
                'api_integration_preference' => [
                    'rest_api_integration' => [
                        'integration_method' => 'PAYPAL',
                        'integration_type' => 'THIRD_PARTY',
                        'third_party_details' => [
                            'features' => ['PAYMENT', 'REFUND', 'PARTNER_FEE'],
                        ],
                    ],
                ],
            ],
        ],
        'products' => ['EXPRESS_CHECKOUT'],
        'legal_consents' => [
            ['type' => 'SHARE_DATA_CONSENT', 'granted' => true],
        ],
    ];

    $json = json_encode($payload, JSON_THROW_ON_ERROR);

    $ch = curl_init($baseUrl . '/v2/customer/partner-referrals');
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
    $body = curl_exec($ch);
    $code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    if ($body === false || $code < 200 || $code >= 300) {
        throw new RuntimeException('partner-referrals failed: HTTP ' . $code . ' ' . (string) $body);
    }

    return json_decode($body, true, 512, JSON_THROW_ON_ERROR);
}
```

Resolve the seller **`action_url`** from **`links`** where **`rel`** is **`action_url`** and redirect the seller there.

## Merchant integration status — `GET`

```php
<?php

function merchant_integration_status(
    string $accessToken,
    string $partnerId,
    string $merchantId,
    string $baseUrl
): array {
    $path = '/v1/customer/partners/' . rawurlencode($partnerId)
        . '/merchant-integrations/' . rawurlencode($merchantId);

    $ch = curl_init($baseUrl . $path);
    curl_setopt_array($ch, [
        CURLOPT_HTTPGET => true,
        CURLOPT_HTTPHEADER => [
            'Authorization: Bearer ' . $accessToken,
            'Accept: application/json',
        ],
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT => 30,
    ]);
    $body = curl_exec($ch);
    $code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    if ($body === false || $code < 200 || $code >= 300) {
        throw new RuntimeException('merchant-integrations GET failed: HTTP ' . $code);
    }

    return json_decode($body, true, 512, JSON_THROW_ON_ERROR);
}
```

Check **`payments_receivable`**, **`primary_email_confirmed`**, and **`oauth_integrations`** before live captures.

## Laravel — controller excerpt

```php
<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Http;

class PartnerReferralController extends Controller
{
    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'tracking_id' => ['required', 'string'],
            'return_url' => ['required', 'url'],
        ]);

        $base = config('services.paypal.environment') === 'production'
            ? 'https://api-m.paypal.com'
            : 'https://api-m.sandbox.paypal.com';

        $token = Http::asForm()
            ->withBasicAuth(config('services.paypal.client_id'), config('services.paypal.secret'))
            ->post($base . '/v1/oauth2/token', ['grant_type' => 'client_credentials'])
            ->throw()
            ->json('access_token');

        $body = [
            'tracking_id' => $validated['tracking_id'],
            'partner_config_override' => ['return_url' => $validated['return_url']],
            'operations' => [[
                'operation' => 'API_INTEGRATION',
                'api_integration_preference' => [
                    'rest_api_integration' => [
                        'integration_method' => 'PAYPAL',
                        'integration_type' => 'THIRD_PARTY',
                        'third_party_details' => [
                            'features' => ['PAYMENT', 'REFUND', 'PARTNER_FEE'],
                        ],
                    ],
                ],
            ]],
            'products' => ['EXPRESS_CHECKOUT'],
            'legal_consents' => [['type' => 'SHARE_DATA_CONSENT', 'granted' => true]],
        ];

        $res = Http::withToken($token)
            ->acceptJson()
            ->post($base . '/v2/customer/partner-referrals', $body)
            ->throw();

        return response()->json($res->json());
    }
}
```

Map **`PAYPAL_CLIENT_ID`**, **`PAYPAL_CLIENT_SECRET`**, and **`PAYPAL_ENVIRONMENT`** in **`config/services.php`**.

## Notes

- Use a unique **`tracking_id`** per onboarding attempt.
- Store the seller **`merchant_id`** for **`PayPal-Auth-Assertion`** on orders (`multiparty-create-order.md`).

## Related snippets

- `multiparty-create-order.md` — orders with platform fees
- `webhooks.md` — seller onboarding events
