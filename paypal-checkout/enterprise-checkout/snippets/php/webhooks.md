# Webhooks — `webhookNotification()->parse()`, PayPal verify-webhook-signature

Verify signatures **before** acting on payloads. Respond **200** quickly and process heavy work asynchronously (queue jobs).

Braintree delivers **`bt_signature`** and **`bt_payload`** as form fields. Parse them with **`$gateway->webhookNotification()->parse(...)`** (official PHP pattern); the return type is **`Braintree\WebhookNotification`** (older samples sometimes reference the legacy class name `Braintree_WebhookNotification`).

REST bases for PayPal verification:

| Environment | Base URL |
|-------------|----------|
| Sandbox | `https://api-m.sandbox.paypal.com` |
| Production | `https://api-m.paypal.com` |

## Braintree — `$gateway->webhookNotification()->parse()`

Configure the webhook URL in the **Braintree Control Panel**. The POST body is **`application/x-www-form-urlencoded`** with **`bt_signature`** and **`bt_payload`**.

```php
<?php
declare(strict_types=1);

use Braintree\Gateway;
use Braintree\Exception\InvalidSignature;

require __DIR__ . '/../vendor/autoload.php';

$gateway = new Gateway([
    'environment' => ($_ENV['BRAINTREE_ENVIRONMENT'] ?? 'sandbox') === 'production' ? 'production' : 'sandbox',
    'merchantId' => $_ENV['BRAINTREE_MERCHANT_ID'] ?? '',
    'publicKey' => $_ENV['BRAINTREE_PUBLIC_KEY'] ?? '',
    'privateKey' => $_ENV['BRAINTREE_PRIVATE_KEY'] ?? '',
]);

$btSignature = $_POST['bt_signature'] ?? '';
$btPayload = $_POST['bt_payload'] ?? '';

try {
    $notification = $gateway->webhookNotification()->parse($btSignature, $btPayload);
} catch (InvalidSignature) {
    http_response_code(400);
    exit;
}

// $notification->kind is a string such as "transaction_settled", "dispute_opened", …
switch ($notification->kind) {
    case 'transaction_settled':
        // $notification->transaction
        break;
    case 'transaction_settlement_declined':
        break;
    case 'dispute_opened':
    case 'dispute_lost':
    case 'dispute_won':
        // $notification->dispute
        break;
    default:
        break;
}

http_response_code(200);
header('Content-Type: text/plain');
echo 'ok';
```

Invalid signatures raise **`Braintree\Exception\InvalidSignature`** — fail closed (do not process the payload).

### Common `kind` values (examples)

Strings are **snake_case** (for example **`transaction_settled`**, **`transaction_settlement_declined`**, **`dispute_opened`**). Subscription lifecycle events apply if you use Braintree subscriptions.

## PayPal — `POST /v1/notifications/verify-webhook-signature`

Forward the webhook headers and JSON body to PayPal for verification. Store **`PAYPAL_WEBHOOK_ID`** from the developer dashboard.

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

function paypal_verify_webhook(
    string $accessToken,
    string $webhookId,
    string $authAlgo,
    string $certUrl,
    string $transmissionId,
    string $transmissionSig,
    string $transmissionTime,
    array $webhookEvent
): bool {
    $body = json_encode([
        'auth_algo' => $authAlgo,
        'cert_url' => $certUrl,
        'transmission_id' => $transmissionId,
        'transmission_sig' => $transmissionSig,
        'transmission_time' => $transmissionTime,
        'webhook_id' => $webhookId,
        'webhook_event' => $webhookEvent,
    ], JSON_THROW_ON_ERROR);

    $ch = curl_init(paypal_base_url() . '/v1/notifications/verify-webhook-signature');
    curl_setopt_array($ch, [
        CURLOPT_POST => true,
        CURLOPT_POSTFIELDS => $body,
        CURLOPT_HTTPHEADER => [
            'Authorization: Bearer ' . $accessToken,
            'Content-Type: application/json',
        ],
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT => 30,
    ]);
    $raw = curl_exec($ch);
    $code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    if ($raw === false || $code < 200 || $code >= 300) {
        return false;
    }
    $json = json_decode($raw, true, 512, JSON_THROW_ON_ERROR);

    return ($json['verification_status'] ?? '') === 'SUCCESS';
}
```

**Controller usage** — read headers **`PAYPAL-AUTH-ALGO`**, **`PAYPAL-CERT-URL`**, **`PAYPAL-TRANSMISSION-ID`**, **`PAYPAL-TRANSMISSION-SIG`**, **`PAYPAL-TRANSMISSION-TIME`**, and parse the request body as **`webhook_event`**.

```php
<?php

$verified = paypal_verify_webhook(
    $accessToken,
    $_ENV['PAYPAL_WEBHOOK_ID'] ?? '',
    $_SERVER['HTTP_PAYPAL_AUTH_ALGO'] ?? '',
    $_SERVER['HTTP_PAYPAL_CERT_URL'] ?? '',
    $_SERVER['HTTP_PAYPAL_TRANSMISSION_ID'] ?? '',
    $_SERVER['HTTP_PAYPAL_TRANSMISSION_SIG'] ?? '',
    $_SERVER['HTTP_PAYPAL_TRANSMISSION_TIME'] ?? '',
    json_decode(file_get_contents('php://input'), true, 512, JSON_THROW_ON_ERROR)
);

if (!$verified) {
    http_response_code(400);
    exit;
}

// Dispatch job to handle $eventType = $webhookEvent['event_type']
```

### Common `event_type` values (examples)

- **`PAYMENT.CAPTURE.COMPLETED`**, **`PAYMENT.CAPTURE.DENIED`**, **`PAYMENT.CAPTURE.REFUNDED`**
- **`MERCHANT.ONBOARDING.COMPLETED`**
- **`CUSTOMER.MERCHANT-INTEGRATION.SELLER-ONBOARDING.STARTED`**, **`...COMPLETED`**

Log **`paypal-debug-id`** on upstream errors.

## Laravel — Braintree route

```php
<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use Braintree\Exception\InvalidSignature;
use Braintree\Gateway;
use Braintree\WebhookNotification;
use Illuminate\Http\Request;
use Illuminate\Http\Response;

class BraintreeWebhookController extends Controller
{
    public function __construct(private readonly Gateway $gateway)
    {
    }

    public function __invoke(Request $request): Response
    {
        try {
            $notification = $this->gateway->webhookNotification()->parse(
                (string) $request->input('bt_signature'),
                (string) $request->input('bt_payload')
            );
        } catch (InvalidSignature) {
            return response('', 400);
        }

        dispatch(fn () => $this->handleKind($notification->kind, $notification));

        return response('ok', 200);
    }

    private function handleKind(string $kind, WebhookNotification $notification): void
    {
        // queue work
    }
}
```

## Related snippets

- `seller-onboarding.md` — OAuth token for PayPal verification
- `error-handling.md` — logging and retries
