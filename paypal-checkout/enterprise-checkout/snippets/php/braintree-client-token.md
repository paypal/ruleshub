# Braintree Client Token — Enterprise Checkout (PHP)

Generate a **client token** on your server with **`$gateway->clientToken()->generate()`** so the browser can initialize `braintree.client`, Drop-in UI, or Hosted Fields. Never expose Braintree private keys to the client.

## Endpoint (typical)

| Method | Path | Response |
|--------|------|----------|
| **POST** | `/api/braintree/client-token` (or `routes/api.php` name) | JSON: `{ "client_token": "<token>" }` |

The browser calls this endpoint, then passes **`client_token`** into `braintree.client.create` / Drop-in / Hosted Fields.

## Dependencies

- `braintree/braintree_php`
- PHP 8.1+, Composer autoload

## Vanilla PHP — JSON endpoint

```php
<?php
declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');

require __DIR__ . '/../vendor/autoload.php';

use Braintree\Gateway;

$gateway = new Gateway([
    'environment' => ($_ENV['BRAINTREE_ENVIRONMENT'] ?? getenv('BRAINTREE_ENVIRONMENT') ?: 'sandbox') === 'production'
        ? 'production'
        : 'sandbox',
    'merchantId' => $_ENV['BRAINTREE_MERCHANT_ID'] ?? getenv('BRAINTREE_MERCHANT_ID') ?: '',
    'publicKey' => $_ENV['BRAINTREE_PUBLIC_KEY'] ?? getenv('BRAINTREE_PUBLIC_KEY') ?: '',
    'privateKey' => $_ENV['BRAINTREE_PRIVATE_KEY'] ?? getenv('BRAINTREE_PRIVATE_KEY') ?: '',
]);

try {
    $result = $gateway->clientToken()->generate();
    // Result is a string client token
    echo json_encode(['client_token' => $result], JSON_THROW_ON_ERROR);
} catch (Throwable $e) {
    http_response_code(500);
    echo json_encode(['error' => 'Could not generate client token']);
}
```

## Optional: customer-scoped client token (vault)

If the buyer is logged in and you have a Braintree `customer_id`, pass it so saved payment methods appear:

```php
<?php

$customerId = $_SESSION['braintree_customer_id'] ?? null;

$clientToken = $customerId
    ? $gateway->clientToken()->generate(['customerId' => $customerId])
    : $gateway->clientToken()->generate();
```

## Laravel — route + controller

**`routes/api.php`** (or `web.php` with CSRF as appropriate):

```php
<?php

use App\Http\Controllers\BraintreeClientTokenController;
use Illuminate\Support\Facades\Route;

Route::post('/braintree/client-token', [BraintreeClientTokenController::class, 'store']);
```

**`app/Http/Controllers/BraintreeClientTokenController.php`**

```php
<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use Braintree\Gateway;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class BraintreeClientTokenController extends Controller
{
    public function __construct(
        private readonly Gateway $braintree
    ) {
    }

    public function store(Request $request): JsonResponse
    {
        $customerId = $request->user()?->braintree_customer_id;

        try {
            $token = $customerId
                ? $this->braintree->clientToken()->generate(['customerId' => $customerId])
                : $this->braintree->clientToken()->generate();

            return response()->json(['client_token' => $token]);
        } catch (\Throwable) {
            return response()->json(['error' => 'Could not generate client token'], 500);
        }
    }
}
```

Register `Braintree\Gateway` in `AppServiceProvider` using `config('services.braintree')` (merchant ID, keys, environment).

## Client usage

Pass `client_token` to `braintree.client.create({ authorization: clientToken })`, then Drop-in or Hosted Fields. See `drop-in-ui-integration.md` and `hosted-fields-integration.md`.

## Related snippets

- `prerequisites.md` — Composer and env vars
- `drop-in-ui-integration.md` — Drop-in UI
- `hosted-fields-integration.md` — Hosted Fields
