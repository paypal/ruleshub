# SDK Initialization — Expanded Checkout (PHP page template + Card Fields JS)

Your **PHP** app typically serves an HTML checkout page that loads the PayPal JS SDK with **Card Fields**. The server also exposes a **browser-safe client token** endpoint (see `client-token-generation.md`).

## Script URLs (JS SDK v6)

| Environment | Script `src` |
|-------------|--------------|
| Sandbox | `https://www.sandbox.paypal.com/web-sdk/v6/core` |
| Production | `https://www.paypal.com/web-sdk/v6/core` |

## JS SDK v5 (alternative)

```
https://www.sandbox.paypal.com/sdk/js?client-id=CLIENT_ID&components=buttons,card-fields&currency=USD
```

## PHP template — `public/checkout-expanded.php`

This example outputs HTML with placeholders; wire routes so `/paypal-api/auth/browser-safe-client-token` returns JSON from your PHP handler.

```php
<?php
declare(strict_types=1);

$paypalClientId = $_ENV['PAYPAL_CLIENT_ID'] ?? getenv('PAYPAL_CLIENT_ID') ?: '';
$isSandbox = ($_ENV['PAYPAL_ENVIRONMENT'] ?? getenv('PAYPAL_ENVIRONMENT') ?: 'sandbox') !== 'production';
$scriptHost = $isSandbox ? 'https://www.sandbox.paypal.com' : 'https://www.paypal.com';
?>
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>Expanded Checkout</title>
  <script src="<?= htmlspecialchars($scriptHost, ENT_QUOTES) ?>/web-sdk/v6/core"></script>
</head>
<body>
  <h1>Checkout</h1>

  <div id="paypal-buttons"></div>

  <form id="card-form">
    <div id="card-number"></div>
    <div id="card-expiry"></div>
    <div id="card-cvv"></div>
    <div id="card-name"></div>
    <button type="submit" id="card-pay-button">Pay with card</button>
  </form>

  <script>
    const PAYPAL_CLIENT_ID = <?= json_encode($paypalClientId, JSON_THROW_ON_ERROR) ?>;

    async function getClientToken() {
      const r = await fetch('/paypal-api/auth/browser-safe-client-token');
      if (!r.ok) throw new Error('Client token failed');
      const data = await r.json();
      return data.accessToken;
    }

    async function initExpandedCheckoutV6() {
      const clientToken = await getClientToken();
      const sdk = await window.paypal.createInstance({
        clientId: PAYPAL_CLIENT_ID,
        clientToken,
        components: ['paypal-payments', 'card-fields'],
        pageType: 'checkout',
      });

      const eligible = await sdk.findEligibleMethods({ currencyCode: 'USD' });
      console.log('Eligible:', eligible);

      // Mount PayPal buttons and Card Fields per your integration (see card-fields-integration.md)
      return sdk;
    }

    initExpandedCheckoutV6().catch(console.error);
  </script>
</body>
</html>
```

## Notes

- **`components`** must include **`card-fields`** or the card UI will not be available.
- Keep **currency** consistent across eligibility, `POST /v2/checkout/orders`, and capture.
- Never embed `PAYPAL_CLIENT_SECRET` in this page — only public `clientId` and server-issued `clientToken`.

## Optional: Laravel Blade excerpt

```blade
<script src="{{ config('services.paypal.environment') === 'production' ? 'https://www.paypal.com' : 'https://www.sandbox.paypal.com' }}/web-sdk/v6/core"></script>
<script>
  const PAYPAL_CLIENT_ID = @json(config('services.paypal.client_id'));
</script>
```

Point `fetch('/paypal-api/auth/browser-safe-client-token')` at a Laravel route that implements `client-token-generation.md`.
