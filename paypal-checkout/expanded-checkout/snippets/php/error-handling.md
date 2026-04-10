# Error Handling — Expanded Checkout (PHP + cURL)

Handle **HTTP errors**, **cURL transport failures**, and **card-specific** decline codes from Orders and Payments APIs. Always log **`paypal-debug-id`** response headers for PayPal support.

## PayPal API base URLs

| Environment | Base URL |
|-------------|----------|
| Sandbox | `https://api-m.sandbox.paypal.com` |
| Production | `https://api-m.paypal.com` |

## cURL: transport errors

Check **`curl_errno`**, **`curl_error`**, and timeouts before parsing JSON.

```php
<?php
declare(strict_types=1);

function paypal_curl_exec_with_debug(\CurlHandle $ch): array
{
    $raw = curl_exec($ch);
    $errno = curl_errno($ch);
    $errstr = curl_error($ch);
    $http = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $headerSize = (int) curl_getinfo($ch, CURLINFO_HEADER_SIZE);

    if ($errno !== 0) {
        throw new RuntimeException('cURL error ' . $errno . ': ' . $errstr);
    }
    if (!is_string($raw)) {
        throw new RuntimeException('Empty cURL response');
    }

    $headers = substr($raw, 0, $headerSize);
    $body = substr($raw, $headerSize);
    $debugId = null;
    if (preg_match('/paypal-debug-id:\s*(\S+)/i', $headers, $m)) {
        $debugId = $m[1];
    }

    return ['http' => $http, 'body' => $body, 'paypal_debug_id' => $debugId];
}
```

## HTTP API errors (4xx / 5xx)

PayPal often returns JSON with **`name`**, **`message`**, and **`details`** (field-level issues).

```php
$decoded = json_decode($body, true, 512, JSON_THROW_ON_ERROR);

if ($http < 200 || $http >= 300) {
    error_log(json_encode([
        'paypal_debug_id' => $debugId,
        'http' => $http,
        'error' => $decoded,
    ], JSON_THROW_ON_ERROR));

    $issue = $decoded['details'][0]['issue'] ?? null;
    // e.g. INVALID_REQUEST, PERMISSION_DENIED — see PayPal troubleshooting docs
}
```

## Card declines

Card payments can fail at **create order**, **approve**, or **capture**. Common patterns:

- **`INSTRUMENT_DECLINED`** — generic decline; ask the payer to retry or use another method.
- **`INSUFFICIENT_FUNDS`**, **`EXPIRED_CARD`**, **`INVALID_SECURITY_CODE`** — issuer or validation messages when present in **`details`**.

Official reference:

- [Card decline errors](https://developer.paypal.com/docs/checkout/advanced/card-decline-errors/)

Surface **user-safe** messages; log raw **`details`** and **`paypal-debug-id`** server-side only.

## Laravel `Http` facade

```php
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Str;

$response = Http::withToken($accessToken)
    ->withHeaders(['PayPal-Request-Id' => (string) Str::uuid()])
    ->post($base . '/v2/checkout/orders', $payload);

if ($response->failed()) {
    $debug = $response->header('paypal-debug-id');
    \Log::warning('PayPal order failed', [
        'status' => $response->status(),
        'body' => $response->json(),
        'paypal_debug_id' => $debug,
    ]);
    return response()->json([
        'message' => $response->json('message') ?? 'Payment request failed',
    ], 422);
}
```

## Retry guidance

- **Do not** blindly retry captures for unknown errors — risk double capture; use idempotency keys where documented.
- For **transient 5xx**, limited retries with backoff may be acceptable for **read** calls; for **writes**, follow PayPal idempotency guidance.

## Related docs

- [Handling payment failures](https://docs.paypal.ai/developer/how-to/api/troubleshooting/handling-payment-failures-with-paypal)
- [Common errors overview](https://docs.paypal.ai/developer/how-to/api/troubleshooting/common-errors/overview)
