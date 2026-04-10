# Braintree 3D Secure — Enterprise Checkout (PHP + client JS)

**3D Secure** adds a liability shift step for eligible cards. On the **client**, use the Braintree **3D Secure** component with Hosted Fields or Drop-in. On the **server**, inspect **`threeDSecureInfo`** on the created transaction (and handle liability / status per your risk policy).

## Client — add 3DS after Hosted Fields (conceptual)

Load `three-d-secure.min.js` from Braintree CDN. Typical flow:

1. `braintree.client.create({ authorization })`
2. `braintree.hostedFields.create({ ... })`
3. `braintree.threeDSecure.create({ client: clientInstance, version: 2 })`
4. On submit: `hostedFieldsInstance.tokenize` → then `threeDSecureInstance.verifyCard({ amount, nonce, bin, ... }, callback)` to get a **3DS-enriched nonce**
5. Send the final nonce to PHP for `transaction()->sale()`

```javascript
// After tokenize succeeds with payload.nonce
threeDSecureInstance.verifyCard({
  amount: '49.99',
  nonce: payload.nonce,
  bin: payload.details.bin,
  email: 'buyer@example.com',
  billingAddress: { givenName: 'Jane', surname: 'Doe', ... }
}, function (err, response) {
  if (err) { /* handle */ return; }
  // response.nonce — use this for server-side sale
  document.querySelector('#payment_method_nonce').value = response.nonce;
  form.submit();
});
```

Exact options follow your Braintree JS version—see [Braintree 3D Secure](https://developer.paypal.com/braintree/docs/guides/3d-secure/).

## Server — sale with 3DS nonce

Use the nonce returned from **verifyCard** (not the pre-3DS nonce) for `transaction()->sale()`.

```php
<?php
declare(strict_types=1);

use Braintree\Gateway;

$gateway = new Gateway([/* ... */]);

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
    $info = $tx->threeDSecureInfo ?? null;
    if ($info) {
        $status = $info->status ?? null;
        $liabilityShifted = $info->liabilityShifted ?? null;
        $enrolled = $info->enrolled ?? null;
    }
}
```

## Inspect `threeDSecureInfo` (PHP)

The Braintree PHP SDK exposes nested objects on `$transaction`. Common fields include **status**, **enrolled**, **liabilityShifted**, **liabilityShiftPossible** (names may vary slightly by SDK version—dump in sandbox when testing).

```php
<?php

if ($result->success) {
    $tx = $result->transaction;
    if (isset($tx->threeDSecureInfo)) {
        $tds = $tx->threeDSecureInfo;
        // Use for risk / compliance logging only; do not log full PAN
    }
}
```

## Laravel

Same server logic in a controller; return JSON errors if 3DS fails on the client before posting the nonce.

## Related snippets

- `hosted-fields-integration.md` — tokenize step before 3DS
- `error-handling.md` — failed verification / processor errors
