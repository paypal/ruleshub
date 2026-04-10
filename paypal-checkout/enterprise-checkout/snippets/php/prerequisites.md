# Prerequisites — PayPal Enterprise Checkout (PHP)

Enterprise Checkout combines **Braintree Direct** (`braintree/braintree_php`) for cards, vault, fraud tools, Drop-in UI, and Hosted Fields with **Multiparty / Platform** flows (seller onboarding, platform fees) via **PayPal REST** using **cURL**. **Agentic Commerce / Store Sync** uses the Cart API and related REST endpoints. Use this checklist before you integrate.

## Two pillars + Store Sync

| Pillar | Stack | Use for |
|--------|--------|---------|
| **Braintree Direct** | `braintree/braintree_php`, `Braintree\Gateway` | Enterprise card processing, vault, fraud tools, Drop-in UI, Hosted Fields |
| **Multiparty / Platform** | cURL + PayPal REST | Marketplace checkout, seller onboarding, `platform_fees`, `PayPal-Auth-Assertion` |
| **Agentic Commerce / Store Sync** | Cart API + Orders v2 (or Braintree per docs) | AI agent discovery, carts, checkout completion |

## Runtime

| Requirement | Notes |
|-------------|--------|
| **PHP** | **8.1+** (8.2+ recommended) |
| **Composer** | **2.x** |

## Required PHP extensions

| Extension | Purpose |
|-----------|---------|
| **curl** | OAuth, Orders v2, partner referrals, cart, webhook verification |
| **json** | Request/response bodies |
| **mbstring** | Safe string handling |
| **openssl** | TLS to API hosts |

Verify:

```bash
php -m | grep -E 'curl|json|mbstring|openssl'
```

## Composer

**`composer.json` (typical)**

```json
{
  "require": {
    "php": "^8.1",
    "braintree/braintree_php": "^6.0",
    "vlucas/phpdotenv": "^5.6"
  }
}
```

```bash
composer require braintree/braintree_php vlucas/phpdotenv
```

## Environment variables

Never commit secrets.

### Braintree (`Braintree\Gateway`)

| Variable | Description |
|----------|-------------|
| `BRAINTREE_MERCHANT_ID` | Merchant ID from Braintree Control Panel |
| `BRAINTREE_PUBLIC_KEY` | Public key |
| `BRAINTREE_PRIVATE_KEY` | Private key — **server only** |
| `BRAINTREE_ENVIRONMENT` | `sandbox` or `production` (map to `Braintree\Configuration::environment()`) |

### PayPal REST (multiparty, Cart API, webhooks)

| Variable | Description |
|----------|-------------|
| `PAYPAL_CLIENT_ID` | REST app Client ID |
| `PAYPAL_CLIENT_SECRET` | REST secret — **server only** |
| `PAYPAL_ENVIRONMENT` | `sandbox` or `production` |
| `PAYPAL_PARTNER_MERCHANT_ID` | Platform partner PayPal merchant ID (multiparty, `PayPal-Auth-Assertion`) |

Optional: `PAYPAL_WEBHOOK_ID` for `POST /v1/notifications/verify-webhook-signature`.

### REST API base URLs

| Environment | Base URL |
|-------------|----------|
| Sandbox | `https://api-m.sandbox.paypal.com` |
| Production | `https://api-m.paypal.com` |

### Example `.env`

```env
# Braintree
BRAINTREE_MERCHANT_ID=your_merchant_id
BRAINTREE_PUBLIC_KEY=your_public_key
BRAINTREE_PRIVATE_KEY=your_private_key
BRAINTREE_ENVIRONMENT=sandbox

# PayPal REST
PAYPAL_CLIENT_ID=your_paypal_client_id
PAYPAL_CLIENT_SECRET=your_paypal_client_secret
PAYPAL_ENVIRONMENT=sandbox
PAYPAL_PARTNER_MERCHANT_ID=your_partner_merchant_id
PAYPAL_WEBHOOK_ID=your_webhook_id
```

### Map environment to PayPal REST base (PHP)

```php
<?php

function paypal_base_url(): string
{
    $env = $_ENV['PAYPAL_ENVIRONMENT'] ?? getenv('PAYPAL_ENVIRONMENT') ?: 'sandbox';

    return $env === 'production'
        ? 'https://api-m.paypal.com'
        : 'https://api-m.sandbox.paypal.com';
}
```

### Braintree Gateway bootstrap (vanilla PHP)

```php
<?php
declare(strict_types=1);

require __DIR__ . '/../vendor/autoload.php';

use Braintree\Gateway;

$gateway = new Gateway([
    'environment' => ($_ENV['BRAINTREE_ENVIRONMENT'] ?? 'sandbox') === 'production'
        ? 'production'
        : 'sandbox',
    'merchantId' => $_ENV['BRAINTREE_MERCHANT_ID'] ?? '',
    'publicKey' => $_ENV['BRAINTREE_PUBLIC_KEY'] ?? '',
    'privateKey' => $_ENV['BRAINTREE_PRIVATE_KEY'] ?? '',
]);
```

## Client scripts (Braintree)

Load the Braintree JS client from Braintree’s CDN (see [Braintree client SDK](https://developer.paypal.com/braintree/docs/guides/client-sdk/javascript/v3)). Drop-in and Hosted Fields require `braintree.client` plus the relevant component.

## Suggested layout

```
project/
├── public/
│   └── checkout.php
├── src/
│   ├── braintree-gateway.php
│   ├── paypal-oauth.php
│   └── routes/
├── .env
└── composer.json
```

## Laravel (optional)

Map the same keys in `config/services.php` and use `config('services.braintree.*')` / `config('services.paypal.*')` in controllers.

## Related snippets

- `braintree-client-token.md` — `clientToken()->generate()`
- `multiparty-create-order.md` — `payment_source.paypal.experience_context` (not `application_context`)
- `agentic-commerce.md` — Cart API
