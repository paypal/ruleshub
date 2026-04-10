# Prerequisites — PayPal Standard Checkout (PHP)

Use this checklist before integrating PayPal Standard Checkout with a PHP backend.

## Runtime

| Requirement | Notes |
|---------------|--------|
| **PHP** | **8.1+** (8.2+ recommended; typed properties, `readonly`, enums if you use them) |
| **Composer** | **2.x** for dependency management |

## Required PHP extensions

Enable these in `php.ini` or your platform package manager:

| Extension | Purpose |
|-----------|---------|
| **curl** | PayPal REST calls (OAuth, Orders, Payments, webhooks) |
| **json** | Encode/decode request and response bodies |
| **mbstring** | Safe string handling for international amounts and metadata |
| **openssl** | TLS to `api-m.sandbox.paypal.com` / `api-m.paypal.com` |

Verify locally:

```bash
php -m | grep -E 'curl|json|mbstring|openssl'
```

## Composer dependencies

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

`vlucas/phpdotenv` loads `.env` in development. In production, prefer real environment variables set by your host or orchestrator (Kubernetes, systemd, PaaS dashboard).

## Bootstrap `.env` (development)

```php
<?php
// public/index.php or bootstrap.php
declare(strict_types=1);

require __DIR__ . '/../vendor/autoload.php';

use Dotenv\Dotenv;

$dotenv = Dotenv::createImmutable(__DIR__ . '/..');
$dotenv->safeLoad(); // does not fail if .env is missing (e.g. production)

```

## Environment variables

Never commit secrets. Set these in `.env` (local) or the deployment environment.

| Variable | Description |
|----------|-------------|
| `PAYPAL_CLIENT_ID` | REST app **Client ID** |
| `PAYPAL_CLIENT_SECRET` | REST app **Secret** (server-side only) |
| `PAYPAL_ENVIRONMENT` | `sandbox` or `production` (drives API base URL) |

**Example `.env`**

```env
PAYPAL_CLIENT_ID=your_sandbox_or_live_client_id
PAYPAL_CLIENT_SECRET=your_sandbox_or_live_secret
PAYPAL_ENVIRONMENT=sandbox
```

## PayPal REST API base URLs

| Environment | Base URL |
|-------------|----------|
| **Sandbox** | `https://api-m.sandbox.paypal.com` |
| **Production** | `https://api-m.paypal.com` |

Read credentials with `$_ENV` or `getenv()` after loading Dotenv:

```php
<?php

$clientId = $_ENV['PAYPAL_CLIENT_ID'] ?? getenv('PAYPAL_CLIENT_ID') ?: '';
$secret = $_ENV['PAYPAL_CLIENT_SECRET'] ?? getenv('PAYPAL_CLIENT_SECRET') ?: '';
$base = ($_ENV['PAYPAL_ENVIRONMENT'] ?? getenv('PAYPAL_ENVIRONMENT')) === 'production'
    ? 'https://api-m.paypal.com'
    : 'https://api-m.sandbox.paypal.com';

```

## Optional: Laravel

Laravel loads `.env` automatically. Add the same keys to `.env` and use `config('services.paypal.*')` by mapping them in `config/services.php` if you prefer structured config.

```php
// config/services.php (excerpt)
'paypal' => [
    'client_id' => env('PAYPAL_CLIENT_ID'),
    'secret' => env('PAYPAL_CLIENT_SECRET'),
    'environment' => env('PAYPAL_ENVIRONMENT', 'sandbox'),
],
```

Use `config('services.paypal.client_id')` in services instead of reading `$_ENV` directly.

## Security notes

- Restrict file permissions on `.env` (`chmod 600`).
- Rotate `PAYPAL_CLIENT_SECRET` if it is ever exposed.
- Use HTTPS for every page that loads the PayPal JS SDK or posts order IDs back to your server.
