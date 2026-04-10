# Braintree Vault — Enterprise Checkout (PHP)

Store payment methods for returning customers: **`$gateway->customer()->create()`**, then **`$gateway->paymentMethod()->create()`** with a nonce, or pass **`customerId`** when generating a client token so Drop-in / Hosted Fields can vault.

## Create customer

```php
<?php
declare(strict_types=1);

use Braintree\Gateway;

$gateway = new Gateway([/* env from prerequisites */]);

$result = $gateway->customer()->create([
    'firstName' => 'Jane',
    'lastName' => 'Buyer',
    'email' => 'jane@example.com',
]);

if ($result->success) {
    $customerId = $result->customer->id;
}
```

## Find customer

```php
<?php

$customer = $gateway->customer()->find($customerId);
// $customer->id, $customer->email, payment methods, etc.
```

## Save payment method (nonce → token)

After the client tokenizes a card (or Drop-in returns a nonce), attach it to the customer:

```php
<?php

$result = $gateway->paymentMethod()->create([
    'customerId' => $customerId,
    'paymentMethodNonce' => $nonceFromClient,
    'options' => [
        'verifyCard' => true,
        'makeDefault' => true,
    ],
]);

if ($result->success) {
    $token = $result->paymentMethod->token; // saved payment method token
}
```

## Charge a saved token

```php
<?php

$result = $gateway->transaction()->sale([
    'amount' => '15.00',
    'paymentMethodToken' => $token,
    'options' => ['submitForSettlement' => true],
]);
```

## Client token for existing customer

```php
<?php

$clientToken = $gateway->clientToken()->generate([
    'customerId' => $customerId,
]);
```

Return `client_token` to the browser so Drop-in / Hosted Fields can show vaulted methods.

## Laravel — example service

```php
<?php

declare(strict_types=1);

namespace App\Services;

use Braintree\Gateway;

class BraintreeVaultService
{
    public function __construct(private readonly Gateway $gateway)
    {
    }

    public function createCustomer(string $email, string $first, string $last): string
    {
        $result = $this->gateway->customer()->create([
            'email' => $email,
            'firstName' => $first,
            'lastName' => $last,
        ]);

        if (!$result->success) {
            throw new \RuntimeException($result->message);
        }

        return $result->customer->id;
    }

    public function vaultNonce(string $customerId, string $nonce): string
    {
        $result = $this->gateway->paymentMethod()->create([
            'customerId' => $customerId,
            'paymentMethodNonce' => $nonce,
            'options' => ['verifyCard' => true, 'makeDefault' => true],
        ]);

        if (!$result->success) {
            throw new \RuntimeException($result->message);
        }

        return $result->paymentMethod->token;
    }
}
```

## Related snippets

- `braintree-client-token.md` — customer-scoped client tokens
- `braintree-transaction.md` — charge with token
