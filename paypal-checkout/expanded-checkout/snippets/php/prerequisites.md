# Prerequisites — PayPal Expanded Checkout (PHP)

Expanded Checkout adds **Card Fields**, **3D Secure**, **Fastlane**, **Apple Pay**, **Google Pay**, and optional **vaulting** on top of Standard Checkout. Use this checklist before you integrate with a **PHP** backend.

## Runtime

| Requirement | Notes |
|-------------|--------|
| **PHP** | **8.1+** (8.2+ recommended) |
| **Composer** | **2.x** for dependency management |

## Required PHP extensions

| Extension | Purpose |
|-----------|---------|
| **curl** | OAuth, Orders v2, Vault v3, webhook verification |
| **json** | Request/response bodies |
| **mbstring** | Safe string handling for international metadata |
| **openssl** | TLS to PayPal API hosts |

Verify locally:

```bash
php -m | grep -E 'curl|json|mbstring|openssl'
```

## Composer

**`composer.json` (minimal)**

```json
{
  "require": {
    "php": "^8.1",
    "vlucas/phpdotenv": "^5.6"
  }
}
```

```bash
composer require vlucas/phpdotenv
```

Use `vlucas/phpdotenv` in local development; in production, inject secrets via the platform (env vars, secrets manager).

## Bootstrap `.env` (development)

```php
<?php
declare(strict_types=1);

require __DIR__ . '/../vendor/autoload.php';

use Dotenv\Dotenv;

$dotenv = Dotenv::createImmutable(__DIR__ . '/..');
$dotenv->safeLoad();
```

## Environment variables

Never commit secrets.

| Variable | Description |
|----------|-------------|
| `PAYPAL_CLIENT_ID` | REST app Client ID |
| `PAYPAL_CLIENT_SECRET` | REST secret — **server only** |
| `PAYPAL_ENVIRONMENT` | `sandbox` or `production` |
| `PAYPAL_WEBHOOK_ID` | Webhook ID (for signature verification) |

**Example `.env`**

```env
PAYPAL_CLIENT_ID=your_client_id
PAYPAL_CLIENT_SECRET=your_client_secret
PAYPAL_ENVIRONMENT=sandbox
PAYPAL_WEBHOOK_ID=your_webhook_id
```

## PayPal REST API base URLs

| Environment | Base URL |
|-------------|----------|
| **Sandbox** | `https://api-m.sandbox.paypal.com` |
| **Production** | `https://api-m.paypal.com` |

```php
<?php

$base = ($_ENV['PAYPAL_ENVIRONMENT'] ?? getenv('PAYPAL_ENVIRONMENT')) === 'production'
    ? 'https://api-m.paypal.com'
    : 'https://api-m.sandbox.paypal.com';
```

## Expanded Checkout eligibility

Confirm merchant and region eligibility before building custom card flows:

- [Expanded Checkout eligibility](https://developer.paypal.com/docs/checkout/advanced/eligibility/)

If you only need PayPal-branded buttons without hosted card fields, **Standard Checkout** may be sufficient.

## API paths (reference)

| Purpose | Method | Path (relative to base URL) |
|---------|--------|------------------------------|
| OAuth (server) | POST | `/v1/oauth2/token` |
| Browser-safe client token (SDK) | POST | `/v1/oauth2/token` with `response_type=client_token&intent=sdk_init` |
| Create order | POST | `/v2/checkout/orders` |
| Capture order | POST | `/v2/checkout/orders/{id}/capture` |
| Vault setup token | POST | `/v3/vault/setup-tokens` |
| Vault payment token | POST | `/v3/vault/payment-tokens` |
| Verify webhook | POST | `/v1/notifications/verify-webhook-signature` |

## Order payload conventions (important)

- Use **`payment_source.paypal.experience_context`** for PayPal wallet flows — **not** the deprecated top-level `application_context`.
- Use **`payment_source.card`** for card payments (with `experience_context` and/or `attributes.verification` as required by your flow).

## Optional: Laravel

Map the same keys in `config/services.php`:

```php
'paypal' => [
    'client_id' => env('PAYPAL_CLIENT_ID'),
    'secret' => env('PAYPAL_CLIENT_SECRET'),
    'environment' => env('PAYPAL_ENVIRONMENT', 'sandbox'),
    'webhook_id' => env('PAYPAL_WEBHOOK_ID'),
],
```

## Security baseline

- Never expose `PAYPAL_CLIENT_SECRET` to the browser.
- Serve checkout over **HTTPS** in production.
- Recompute order totals **server-side**; do not trust client amounts alone.
- Card PAN/CVV are handled by **PayPal Card Fields** — do not collect raw card data in your own inputs.
