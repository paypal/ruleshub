# Error Handling — PHP, cURL, PayPal Responses

Production integrations should **log structured errors**, surface **safe messages** to clients, and capture **PayPal-Debug-Id** from response headers for support tickets.

## cURL checklist

After every `curl_exec`:

1. `curl_errno($ch)` — non-zero means transport failure (DNS, TLS, timeout).
2. `curl_error($ch)` — human-readable message; log before `curl_close`.
3. HTTP status from `curl_getinfo($ch, CURLINFO_HTTP_CODE)`.
4. Parse JSON body; PayPal errors often include `name`, `message`, `details[]`.

```php
<?php
declare(strict_types=1);

function curl_exec_json(
    string $method,
    string $url,
    array $headers,
    ?string $body = null,
    int $timeout = 30
): array {
    $ch = curl_init($url);
    $opts = [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_HEADER => true,
        CURLOPT_TIMEOUT => $timeout,
        CURLOPT_HTTPHEADER => $headers,
    ];
    if ($method === 'POST') {
        $opts[CURLOPT_POST] = true;
        $opts[CURLOPT_POSTFIELDS] = $body ?? '';
    } elseif ($method === 'GET') {
        $opts[CURLOPT_HTTPGET] = true;
    }
    curl_setopt_array($ch, $opts);

    $raw = curl_exec($ch);
    $errno = curl_errno($ch);
    $errstr = curl_error($ch);
    $http = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $headerSize = (int) curl_getinfo($ch, CURLINFO_HEADER_SIZE);
    curl_close($ch);

    if ($errno !== 0 || !is_string($raw)) {
        throw new RuntimeException('cURL transport error: ' . $errstr, $errno);
    }

    $headerBlock = substr($raw, 0, $headerSize);
    $responseBody = substr($raw, $headerSize);

    $debugId = null;
    if (preg_match('/^paypal-debug-id:\s*(\S+)/mi', $headerBlock, $m)) {
        $debugId = $m[1];
    }

    $decoded = null;
    try {
        $decoded = json_decode($responseBody, true, 512, JSON_THROW_ON_ERROR);
    } catch (JsonException $e) {
        $decoded = ['raw' => $responseBody];
    }

    return [
        'http' => $http,
        'headers' => $headerBlock,
        'body' => $decoded,
        'paypalDebugId' => $debugId,
    ];
}
```

## Extract PayPal-Debug-Id

PayPal returns `PayPal-Debug-Id` (case may vary) on error and success. Use it when contacting PayPal support.

```php
<?php
function extract_paypal_debug_id(string $headerBlock): ?string
{
    if (preg_match('/paypal-debug-id:\s*(\S+)/i', $headerBlock, $m)) {
        return $m[1];
    }
    return null;
}
```

## Retry with backoff (idempotent operations)

Use retries for **transient** errors (429, 503, or transport failures). Use **idempotency** keys (`PayPal-Request-Id`) for creates/refunds so retries do not double-charge.

```php
<?php
declare(strict_types=1);

function paypal_request_with_retry(callable $doRequest, int $maxAttempts = 3): array
{
    $attempt = 0;
    $delayMs = 200;
    while (true) {
        $attempt++;
        try {
            $result = $doRequest();
            $http = $result['http'] ?? 0;
            if ($http === 429 || ($http >= 500 && $http < 600)) {
                throw new RuntimeException('retryable HTTP ' . $http);
            }
            return $result;
        } catch (Throwable $e) {
            if ($attempt >= $maxAttempts) {
                throw $e;
            }
            usleep($delayMs * 1000);
            $delayMs = min($delayMs * 2, 5000);
        }
    }
}
```

Wrap your cURL call inside `$doRequest` and return `['http' => ..., ...]`.

## User-facing errors

- Never return raw PayPal JSON to browsers in production; map to generic messages.
- Always log `paypalDebugId` server-side.

```php
<?php
function public_payment_error_message(int $http): string
{
    if ($http === 401 || $http === 403) {
        return 'Payment service authentication failed.';
    }
    if ($http === 422) {
        return 'Payment could not be processed. Try another method.';
    }
    return 'Something went wrong. Please try again.';
}
```

## Optional: Laravel

```php
<?php

use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

try {
    $response = Http::withToken($token)->post($url, $payload);
    $response->throw();
} catch (\Illuminate\Http\Client\RequestException $e) {
    $debugId = $e->response?->header('PayPal-Debug-Id');
    Log::error('PayPal API error', [
        'status' => $e->response?->status(),
        'body' => $e->response?->json(),
        'paypal_debug_id' => $debugId,
    ]);
    return response()->json(['message' => 'Payment error'], 502);
}
```

Laravel HTTP client exposes headers via `$response->header('PayPal-Debug-Id')`.
