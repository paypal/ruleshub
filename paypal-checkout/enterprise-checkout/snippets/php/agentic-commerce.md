# Agentic commerce / Store Sync — Cart API (cURL + Laravel)

**Store Sync** exposes product catalogs for AI agents; the **Cart API** models carts server-side. Typical flow: **create cart** → buyer approves payment → **complete checkout** (or map the cart to **Orders v2** / **Braintree** per [integration docs](https://docs.paypal.ai/growth/agentic-commerce/store-sync/your-api/set-up-your-api/orders-v2-integration)).

REST bases:

| Environment | Base URL |
|-------------|----------|
| Sandbox | `https://api-m.sandbox.paypal.com` |
| Production | `https://api-m.paypal.com` |

Use the same **`client_credentials`** access token as other REST calls (`seller-onboarding.md`).

## Cart API — `POST /v2/cart` — cURL

```php
<?php
declare(strict_types=1);

/**
 * @param  array<string, mixed>  $payload  Body per current Cart API schema (intent, items, payee, experience, etc.)
 * @return array<string, mixed>
 */
function create_cart(string $accessToken, array $payload, string $baseUrl): array
{
    $json = json_encode($payload, JSON_THROW_ON_ERROR);
    $requestId = bin2hex(random_bytes(16));

    $ch = curl_init($baseUrl . '/v2/cart');
    curl_setopt_array($ch, [
        CURLOPT_POST => true,
        CURLOPT_POSTFIELDS => $json,
        CURLOPT_HTTPHEADER => [
            'Authorization: Bearer ' . $accessToken,
            'Content-Type: application/json',
            'Accept: application/json',
            'PayPal-Request-Id: ' . $requestId,
        ],
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT => 60,
    ]);
    $body = curl_exec($ch);
    $code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    if ($body === false || $code < 200 || $code >= 300) {
        throw new RuntimeException('create cart failed: HTTP ' . $code . ' ' . (string) $body);
    }

    return json_decode($body, true, 512, JSON_THROW_ON_ERROR);
}
```

Shape **`$payload`** to match the current **Create cart** reference (line items, amounts, payee, payment experience, etc.).

## `GET /v2/cart/{cart_id}` — cURL

```php
<?php

function get_cart(string $accessToken, string $cartId, string $baseUrl): array
{
    $cid = rawurlencode($cartId);
    $ch = curl_init($baseUrl . '/v2/cart/' . $cid);
    curl_setopt_array($ch, [
        CURLOPT_HTTPGET => true,
        CURLOPT_HTTPHEADER => [
            'Authorization: Bearer ' . $accessToken,
            'Accept: application/json',
        ],
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT => 60,
    ]);
    $body = curl_exec($ch);
    $code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    if ($body === false || $code < 200 || $code >= 300) {
        throw new RuntimeException('get cart failed: HTTP ' . $code);
    }

    return json_decode($body, true, 512, JSON_THROW_ON_ERROR);
}
```

## `PATCH /v2/cart/{cart_id}` — cURL

```php
<?php

/**
 * @param  array<string, mixed>  $patchBody  Per Cart API patch contract
 */
function patch_cart(string $accessToken, string $cartId, array $patchBody, string $baseUrl): array
{
    $cid = rawurlencode($cartId);
    $json = json_encode($patchBody, JSON_THROW_ON_ERROR);
    $requestId = bin2hex(random_bytes(16));

    $ch = curl_init($baseUrl . '/v2/cart/' . $cid);
    curl_setopt_array($ch, [
        CURLOPT_CUSTOMREQUEST => 'PATCH',
        CURLOPT_POSTFIELDS => $json,
        CURLOPT_HTTPHEADER => [
            'Authorization: Bearer ' . $accessToken,
            'Content-Type: application/json',
            'Accept: application/json',
            'PayPal-Request-Id: ' . $requestId,
        ],
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT => 60,
    ]);
    $body = curl_exec($ch);
    $code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    if ($body === false || $code < 200 || $code >= 300) {
        throw new RuntimeException('patch cart failed: HTTP ' . $code . ' ' . (string) $body);
    }

    return json_decode($body, true, 512, JSON_THROW_ON_ERROR);
}
```

## Checkout paths

1. **Orders v2** — map cart totals to **`POST /v2/checkout/orders`** (`multiparty-create-order.md` for platform fees and **`payment_source.paypal.experience_context`**).
2. **Complete checkout** — call **Complete Checkout** after buyer approval per the current [Complete checkout](https://docs.paypal.ai/reference/api/rest/checkout/complete-checkout) contract.
3. **Braintree** — client token + **`transaction()->sale`** (`braintree-transaction.md`); vault if needed (`braintree-vault.md`).

Keep **one source of truth** for amounts so cart lines match Orders or Braintree payloads.

## Laravel — create cart

```php
<?php

declare(strict_types=1);

namespace App\Services;

use Illuminate\Support\Facades\Http;
use Illuminate\Support\Str;

class CartApiService
{
    public function baseUrl(): string
    {
        return config('services.paypal.environment') === 'production'
            ? 'https://api-m.paypal.com'
            : 'https://api-m.sandbox.paypal.com';
    }

    /** @param  array<string, mixed>  $payload */
    public function createCart(string $accessToken, array $payload): array
    {
        return Http::withToken($accessToken)
            ->withHeaders(['PayPal-Request-Id' => (string) Str::uuid()])
            ->acceptJson()
            ->post($this->baseUrl() . '/v2/cart', $payload)
            ->throw()
            ->json();
    }
}
```

## References

- [Agentic commerce overview](https://docs.paypal.ai/growth/agentic-commerce/overview)
- [Store Sync overview](https://docs.paypal.ai/growth/agentic-commerce/store-sync/overview)
- [Create cart](https://docs.paypal.ai/reference/api/rest/cart-operations/create-cart)

## Related snippets

- `multiparty-create-order.md` — marketplace orders
- `prerequisites.md` — OAuth and base URLs
