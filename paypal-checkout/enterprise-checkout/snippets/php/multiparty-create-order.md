# Multiparty create order — `POST /v2/checkout/orders`, `platform_fees`, `experience_context`

Create a **PayPal** order where the **seller** is the payee and the **platform** takes a fee. Use **`payment_source.paypal.experience_context`** for locale, brand, shipping, return/cancel URLs, etc. **Do not** use deprecated top-level **`application_context`** for new integrations.

Use **`PayPal-Auth-Assertion`** (signed JWT) so PayPal knows the partner is acting for the seller. Build the JWT per current multiparty documentation (**`iss`** = partner REST **client_id**, **`payer_id`** = seller merchant id, plus required claims and signing).

REST bases:

| Environment | Base URL |
|-------------|----------|
| Sandbox | `https://api-m.sandbox.paypal.com` |
| Production | `https://api-m.paypal.com` |

## `POST /v2/checkout/orders` — cURL (primary)

```php
<?php
declare(strict_types=1);

/**
 * @param string $authAssertionJwt Signed JWT for PayPal-Auth-Assertion (partner acting for seller)
 */
function multiparty_create_order(
    string $accessToken,
    string $authAssertionJwt,
    string $sellerMerchantId,
    string $platformFeeAmount,
    string $itemTotal,
    string $currencyCode,
    string $baseUrl
): array {
    $payload = [
        'intent' => 'CAPTURE',
        'purchase_units' => [
            [
                'reference_id' => 'default',
                'amount' => [
                    'currency_code' => $currencyCode,
                    'value' => $itemTotal,
                    'breakdown' => [
                        'item_total' => [
                            'currency_code' => $currencyCode,
                            'value' => $itemTotal,
                        ],
                    ],
                ],
                'payee' => [
                    'merchant_id' => $sellerMerchantId,
                ],
                'payment_instruction' => [
                    'platform_fees' => [
                        [
                            'amount' => [
                                'currency_code' => $currencyCode,
                                'value' => $platformFeeAmount,
                            ],
                        ],
                    ],
                ],
            ],
        ],
        'payment_source' => [
            'paypal' => [
                'experience_context' => [
                    'payment_method_preference' => 'IMMEDIATE_PAYMENT_REQUIRED',
                    'brand_name' => 'My Marketplace',
                    'locale' => 'en-US',
                    'landing_page' => 'LOGIN',
                    'user_action' => 'PAY_NOW',
                    'return_url' => 'https://yourplatform.com/paypal/return',
                    'cancel_url' => 'https://yourplatform.com/paypal/cancel',
                    'shipping_preference' => 'GET_FROM_FILE',
                ],
            ],
        ],
    ];

    $json = json_encode($payload, JSON_THROW_ON_ERROR);

    $ch = curl_init($baseUrl . '/v2/checkout/orders');
    curl_setopt_array($ch, [
        CURLOPT_POST => true,
        CURLOPT_POSTFIELDS => $json,
        CURLOPT_HTTPHEADER => [
            'Authorization: Bearer ' . $accessToken,
            'Content-Type: application/json',
            'Accept: application/json',
            'PayPal-Auth-Assertion: ' . $authAssertionJwt,
            'PayPal-Partner-Attribution-Id: PARTNER_BN_CODE',
        ],
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT => 30,
    ]);
    $body = curl_exec($ch);
    $code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    if ($body === false || $code < 200 || $code >= 300) {
        throw new RuntimeException('create order failed: HTTP ' . $code . ' ' . (string) $body);
    }

    return json_decode($body, true, 512, JSON_THROW_ON_ERROR);
}
```

## Important

- **`purchase_units[].payee.merchant_id`**: connected seller merchant id.
- **`payment_instruction.platform_fees`**: platform share; fee currency must match the transaction currency; payee must be bank-eligible per PayPal rules.
- **`payment_source.paypal.experience_context`**: PayPal wallet UX — **not** legacy **`application_context`**.
- **`PayPal-Auth-Assertion`**: required for partner-initiated seller transactions per multiparty docs.

Approve on the client with the JS SDK using the returned **`id`**, then capture (`multiparty-capture.md`).

## Laravel — `Http::` facade

```php
<?php

declare(strict_types=1);

namespace App\Services;

use Illuminate\Support\Facades\Http;

class MultipartyOrderService
{
    public function baseUrl(): string
    {
        return config('services.paypal.environment') === 'production'
            ? 'https://api-m.paypal.com'
            : 'https://api-m.sandbox.paypal.com';
    }

    /**
     * @param  array<string, mixed>  $experienceContext  merged into payment_source.paypal.experience_context
     * @return array<string, mixed>
     */
    public function createOrder(
        string $accessToken,
        string $authAssertionJwt,
        string $sellerMerchantId,
        string $platformFeeAmount,
        string $itemTotal,
        string $currencyCode,
        array $experienceContext = []
    ): array {
        $defaultExperience = [
            'payment_method_preference' => 'IMMEDIATE_PAYMENT_REQUIRED',
            'brand_name' => config('app.name'),
            'locale' => 'en-US',
            'landing_page' => 'LOGIN',
            'user_action' => 'PAY_NOW',
            'return_url' => route('paypal.return'),
            'cancel_url' => route('paypal.cancel'),
            'shipping_preference' => 'GET_FROM_FILE',
        ];

        $body = [
            'intent' => 'CAPTURE',
            'purchase_units' => [[
                'reference_id' => 'default',
                'amount' => [
                    'currency_code' => $currencyCode,
                    'value' => $itemTotal,
                    'breakdown' => [
                        'item_total' => [
                            'currency_code' => $currencyCode,
                            'value' => $itemTotal,
                        ],
                    ],
                ],
                'payee' => ['merchant_id' => $sellerMerchantId],
                'payment_instruction' => [
                    'platform_fees' => [[
                        'amount' => [
                            'currency_code' => $currencyCode,
                            'value' => $platformFeeAmount,
                        ],
                    ]],
                ],
            ]],
            'payment_source' => [
                'paypal' => [
                    'experience_context' => array_merge($defaultExperience, $experienceContext),
                ],
            ],
        ];

        return Http::withToken($accessToken)
            ->withHeaders([
                'PayPal-Auth-Assertion' => $authAssertionJwt,
                'PayPal-Partner-Attribution-Id' => config('services.paypal.bn_code', 'PARTNER_BN_CODE'),
            ])
            ->acceptJson()
            ->post($this->baseUrl() . '/v2/checkout/orders', $body)
            ->throw()
            ->json();
    }
}
```

## Related snippets

- `prerequisites.md` — env vars and REST bases
- `seller-onboarding.md` — partner referrals
- `multiparty-capture.md` — capture and refund
