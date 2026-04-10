# Error handling — Braintree exceptions, cURL and PayPal REST errors

Centralize logging with **transaction ids**, Braintree correlation where available, and PayPal **`paypal-debug-id`** plus response **`details`** for support. Never return raw stack traces or internal messages to browsers in production.

## Braintree PHP SDK

### Failed API calls (`$result->success === false`)

Inspect **`$result->message`**, **`$result->errors`** (deep validation), and on transactions **`processorResponseCode`**, **`processorResponseText`**, **`gatewayRejectionReason`**.

```php
<?php
declare(strict_types=1);

use Braintree\Gateway;

function log_braintree_sale_failure($result): void
{
    if ($result->success) {
        return;
    }
    $tx = $result->transaction;
    $parts = [$result->message];
    if ($tx) {
        $parts[] = $tx->id ?? null;
        $parts[] = $tx->processorResponseCode ?? null;
        $parts[] = $tx->processorResponseText ?? null;
        $parts[] = $tx->gatewayRejectionReason ?? null;
    }
    // Server-side log only; return a generic message to the client
    error_log('braintree_failure ' . json_encode($parts));
}
```

### Exceptions

Wrap gateway calls and catch **`Exception`** (and **`Braintree\Exception`** if you namespace-import it). The SDK may throw on network/configuration errors.

```php
<?php

use Braintree\Gateway;

try {
    $result = $gateway->transaction()->sale([/* ... */]);
} catch (\Throwable $e) {
    error_log('braintree_exception ' . $e->getMessage());
    // return 502 / generic error to client
}
```

### Processor declines (typical codes 2000–2999)

- Map **`processor_response_code`** / **`processor_response_text`** to buyer-safe copy.
- Treat many issuer declines as **not retryable** until the buyer changes the payment method.

### `gateway_rejected`

- Inspect **`gateway_rejection_reason`** (AVS/CVV policy, fraud rules, etc.).

## cURL — detect transport and HTTP failures

```php
<?php
declare(strict_types=1);

/**
 * @return array{0: int, 1: string, 2: ?string} [http_code, body, curl_error]
 */
function paypal_curl_post(string $url, string $body, array $headers): array
{
    $ch = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_POST => true,
        CURLOPT_POSTFIELDS => $body,
        CURLOPT_HTTPHEADER => $headers,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_HEADER => true,
        CURLOPT_TIMEOUT => 60,
    ]);
    $raw = curl_exec($ch);
    $errno = curl_errno($ch);
    $err = $errno ? curl_error($ch) : null;
    $code = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $headerSize = (int) curl_getinfo($ch, CURLINFO_HEADER_SIZE);
    curl_close($ch);

    if ($raw === false) {
        return [0, '', $err];
    }

    $respHeaders = substr($raw, 0, $headerSize);
    $respBody = substr($raw, $headerSize);
    if (preg_match('/paypal-debug-id:\s*(\S+)/i', $respHeaders, $m)) {
        error_log('paypal_debug_id ' . $m[1]);
    }

    return [$code, $respBody, $err];
}
```

Log **`paypal-debug-id`** from response headers on non-2xx responses.

## PayPal REST — common cases

| Situation | What to check |
|-----------|----------------|
| **401** | OAuth token expired or bad **`PAYPAL_CLIENT_ID`** / **`PAYPAL_CLIENT_SECRET`**; sandbox vs production base URL. |
| **403** | Missing scopes or partner permissions for multiparty. |
| **422** | **`details`** array in JSON body — validation / business-rule errors. |
| **Seller not ready** | **`payments_receivable`** false — complete onboarding (`seller-onboarding.md`). |
| **Platform fees** | Currency match with purchase unit; fee rules per multiparty documentation. |

### Decode error JSON safely

```php
<?php

function log_paypal_rest_error(int $httpCode, string $body): void
{
    try {
        $json = json_decode($body, true, 512, JSON_THROW_ON_ERROR);
        $details = $json['details'] ?? $json['message'] ?? $body;
    } catch (\JsonException) {
        $details = $body;
    }
    error_log('paypal_rest_error http=' . $httpCode . ' ' . (is_string($details) ? $details : json_encode($details)));
}
```

## Laravel `Http` facade

Use **`->throw()`** or inspect **`$response->failed()`**, log **`$response->header('PayPal-Debug-Id')`**, and map **`$response->json('message')`** / **`details`** for API errors.

## Client vs server messaging

The **server** decides whether a decline is retryable; the **client** shows a short, generic failure and a support reference id—not raw processor codes unless you maintain a curated mapping.

## Related snippets

- `braintree-transaction.md` — successful sale shape
- `multiparty-create-order.md` — REST order errors
- `webhooks.md` — async notifications
