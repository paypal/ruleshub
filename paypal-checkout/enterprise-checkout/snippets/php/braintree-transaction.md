# Braintree Transaction — Enterprise Checkout (PHP)

Process payments with `$gateway->transaction()->sale()`. Handle **void** (unsettled) and **refund** (settled) via the transaction API.

## Sale (one-time capture)

```php
<?php
declare(strict_types=1);

require __DIR__ . '/../vendor/autoload.php';

use Braintree\Gateway;

$gateway = new Gateway([
    'environment' => ($_ENV['BRAINTREE_ENVIRONMENT'] ?? 'sandbox') === 'production' ? 'production' : 'sandbox',
    'merchantId' => $_ENV['BRAINTREE_MERCHANT_ID'] ?? '',
    'publicKey' => $_ENV['BRAINTREE_PUBLIC_KEY'] ?? '',
    'privateKey' => $_ENV['BRAINTREE_PRIVATE_KEY'] ?? '',
]);

$nonce = $_POST['payment_method_nonce'] ?? '';

$result = $gateway->transaction()->sale([
    'amount' => '49.99',
    'paymentMethodNonce' => $nonce,
    'options' => [
        'submitForSettlement' => true,
    ],
]);

if ($result->success) {
    $tx = $result->transaction;
    // $tx->id, $tx->status, etc.
} else {
    $message = $result->message;
    // inspect $result->errors for validation issues
}
```

## Authorize now, capture later

```php
<?php

$result = $gateway->transaction()->sale([
    'amount' => '100.00',
    'paymentMethodNonce' => $nonce,
    'options' => [
        'submitForSettlement' => false,
    ],
]);

if ($result->success) {
    $transactionId = $result->transaction->id;
    // Later: $gateway->transaction()->submitForSettlement($transactionId, '100.00');
}
```

## Void

Voids work on **authorized** or **submitted_for_settlement** transactions that are not yet settled.

```php
<?php

$result = $gateway->transaction()->void('the_transaction_id');

if ($result->success) {
    // voided
}
```

## Refund

Refunds apply to **settled** (or settling) transactions.

```php
<?php

// Full refund
$result = $gateway->transaction()->refund('the_transaction_id');

// Partial refund
$result = $gateway->transaction()->refund('the_transaction_id', '25.00');

if ($result->success) {
    $refundId = $result->transaction->id;
}
```

## Inspect processor response

```php
<?php

if ($result->success) {
    $tx = $result->transaction;
    $status = $tx->status;
    $processorResponseCode = $tx->processorResponseCode ?? null;
    $processorResponseText = $tx->processorResponseText ?? null;
}
```

## Laravel — controller excerpt

```php
<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use Braintree\Gateway;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;

class BraintreeChargeController extends Controller
{
    public function __construct(private readonly Gateway $gateway)
    {
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'payment_method_nonce' => ['required', 'string'],
            'amount' => ['required', 'string'], // e.g. "10.00"
        ]);

        $result = $this->gateway->transaction()->sale([
            'amount' => $validated['amount'],
            'paymentMethodNonce' => $validated['payment_method_nonce'],
            'options' => ['submitForSettlement' => true],
        ]);

        if (!$result->success) {
            return response()->json(['error' => $result->message], 422);
        }

        return response()->json([
            'transaction_id' => $result->transaction->id,
            'status' => $result->transaction->status,
        ]);
    }
}
```

## Related snippets

- `error-handling.md` — `$result->success`, processor codes
- `braintree-vault.md` — vault with customer + payment method
