# Multiparty capture and refunds — cURL, `PayPal-Auth-Assertion`, platform fee refund

**Capture** the approved order with **`POST /v2/checkout/orders/{order_id}/capture`**. Send the same **`PayPal-Auth-Assertion`** pattern used at create time. **Refunds** can include **`payment_instruction.platform_fees`** to adjust the platform fee component.

REST bases:

| Environment | Base URL |
|-------------|----------|
| Sandbox | `https://api-m.sandbox.paypal.com` |
| Production | `https://api-m.paypal.com` |

## Capture order — cURL

```php
<?php
declare(strict_types=1);

function multiparty_capture_order(
    string $accessToken,
    string $authAssertionJwt,
    string $orderId,
    string $baseUrl
): array {
    $encoded = rawurlencode($orderId);
    $url = $baseUrl . '/v2/checkout/orders/' . $encoded . '/capture';

    $ch = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_POST => true,
        CURLOPT_POSTFIELDS => '{}',
        CURLOPT_HTTPHEADER => [
            'Authorization: Bearer ' . $accessToken,
            'Content-Type: application/json',
            'Accept: application/json',
            'PayPal-Auth-Assertion: ' . $authAssertionJwt,
        ],
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT => 30,
    ]);
    $body = curl_exec($ch);
    $code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    if ($body === false || $code < 200 || $code >= 300) {
        throw new RuntimeException('capture failed: HTTP ' . $code . ' ' . (string) $body);
    }

    return json_decode($body, true, 512, JSON_THROW_ON_ERROR);
}
```

Parse **`purchase_units[0].payments.captures[0]`** and **`seller_receivable_breakdown`** (and related fields) per Orders API v2 for reconciliation.

## Refund capture — platform fee component — cURL

```php
<?php
declare(strict_types=1);

/**
 * Refund a capture; optionally specify platform_fees refund amount in payment_instruction.
 */
function refund_capture_with_platform_fee(
    string $accessToken,
    string $authAssertionJwt,
    string $captureId,
    string $totalRefundAmount,
    string $platformFeeRefundAmount,
    string $currencyCode,
    string $baseUrl
): array {
    $payload = [
        'amount' => [
            'currency_code' => $currencyCode,
            'value' => $totalRefundAmount,
        ],
        'payment_instruction' => [
            'platform_fees' => [
                [
                    'amount' => [
                        'currency_code' => $currencyCode,
                        'value' => $platformFeeRefundAmount,
                    ],
                ],
            ],
        ],
    ];

    $json = json_encode($payload, JSON_THROW_ON_ERROR);
    $encoded = rawurlencode($captureId);
    $url = $baseUrl . '/v2/payments/captures/' . $encoded . '/refund';

    $ch = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_POST => true,
        CURLOPT_POSTFIELDS => $json,
        CURLOPT_HTTPHEADER => [
            'Authorization: Bearer ' . $accessToken,
            'Content-Type: application/json',
            'Accept: application/json',
            'PayPal-Auth-Assertion: ' . $authAssertionJwt,
        ],
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT => 30,
    ]);
    $body = curl_exec($ch);
    $code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    if ($body === false || $code < 200 || $code >= 300) {
        throw new RuntimeException('refund failed: HTTP ' . $code . ' ' . (string) $body);
    }

    return json_decode($body, true, 512, JSON_THROW_ON_ERROR);
}
```

Align amounts with PayPal multiparty refund rules (currency match, eligible captures). See the current **Refund captured payment** reference for optional fields.

## Laravel — capture + refund

```php
<?php

declare(strict_types=1);

namespace App\Services;

use Illuminate\Support\Facades\Http;

class MultipartyCaptureService
{
    public function baseUrl(): string
    {
        return config('services.paypal.environment') === 'production'
            ? 'https://api-m.paypal.com'
            : 'https://api-m.sandbox.paypal.com';
    }

    /** @return array<string, mixed> */
    public function capture(string $accessToken, string $authAssertionJwt, string $orderId): array
    {
        $id = rawurlencode($orderId);

        return Http::withToken($accessToken)
            ->withHeaders(['PayPal-Auth-Assertion' => $authAssertionJwt])
            ->acceptJson()
            ->post($this->baseUrl() . "/v2/checkout/orders/{$id}/capture", (object) [])
            ->throw()
            ->json();
    }

    /**
     * @return array<string, mixed>
     */
    public function refundCapture(
        string $accessToken,
        string $authAssertionJwt,
        string $captureId,
        string $totalRefundAmount,
        string $platformFeeRefundAmount,
        string $currencyCode
    ): array {
        $cid = rawurlencode($captureId);
        $body = [
            'amount' => [
                'currency_code' => $currencyCode,
                'value' => $totalRefundAmount,
            ],
            'payment_instruction' => [
                'platform_fees' => [[
                    'amount' => [
                        'currency_code' => $currencyCode,
                        'value' => $platformFeeRefundAmount,
                    ],
                ]],
            ],
        ];

        return Http::withToken($accessToken)
            ->withHeaders(['PayPal-Auth-Assertion' => $authAssertionJwt])
            ->acceptJson()
            ->post($this->baseUrl() . "/v2/payments/captures/{$cid}/refund", $body)
            ->throw()
            ->json();
    }
}
```

## Related snippets

- `multiparty-create-order.md` — create with `experience_context`
- `error-handling.md` — REST and cURL failures
