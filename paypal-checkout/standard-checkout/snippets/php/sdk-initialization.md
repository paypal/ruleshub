# SDK Initialization — Client-Side HTML / JavaScript

Standard Checkout loads the PayPal JavaScript SDK in the browser. Your PHP app typically renders a template that includes the script and your backend URLs for orders.

**Sandbox script hosts:** use `www.sandbox.paypal.com` variants.  
**Live:** use `www.paypal.com`.

## PHP template shell

```php
<?php
declare(strict_types=1);
$paypalClientId = $_ENV['PAYPAL_CLIENT_ID'] ?? getenv('PAYPAL_CLIENT_ID') ?: '';
$createOrderUrl = '/paypal-api/checkout/orders/create';
$captureOrderUrl = '/paypal-api/checkout/orders/capture';
$isSandbox = ($_ENV['PAYPAL_ENVIRONMENT'] ?? getenv('PAYPAL_ENVIRONMENT')) !== 'production';
?>
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>Checkout</title>
</head>
<body>
  <div id="paypal-buttons-container"></div>

  <?php if ($isSandbox): ?>
  <script src="https://www.sandbox.paypal.com/web-sdk/v6/core"></script>
  <?php else: ?>
  <script src="https://www.paypal.com/web-sdk/v6/core"></script>
  <?php endif; ?>

  <script type="module">
    const clientId = <?= json_encode($paypalClientId, JSON_THROW_ON_ERROR) ?>;
    const createOrderUrl = <?= json_encode($createOrderUrl, JSON_THROW_ON_ERROR) ?>;
    const captureUrl = <?= json_encode($captureOrderUrl, JSON_THROW_ON_ERROR) ?>;

    const sdk = await window.paypal.createInstance({
      clientId,
      components: ['paypal-payments'],
      pageType: 'checkout',
    });

    const paypalPaymentSession = await sdk.createPayPalOneTimePaymentSession({
      async onApprove({ orderID }) {
        const res = await fetch(captureUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ orderID }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Capture failed');
        return data;
      },
      async createOrder() {
        const res = await fetch(createOrderUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            amount: { currency_code: 'USD', value: '10.00' },
          }),
        });
        const data = await res.json();
        if (!res.ok || !data.id) throw new Error(data.error || 'Create order failed');
        return data.id;
      },
    });

    const button = document.createElement('paypal-button');
    button.paymentSession = paypalPaymentSession;
    document.getElementById('paypal-buttons-container').appendChild(button);
  </script>
</body>
</html>
```

If you use **browser-safe client tokens** for v6, fetch `/paypal-api/auth/browser-safe-client-token` first and pass the token into `createInstance` per current [JS SDK v6 configuration](https://docs.paypal.ai/developer/how-to/sdk/js/v6/configuration).

## JS SDK v5 — `paypal.Buttons`

Classic Smart Payment Buttons pattern:

```php
<?php
$paypalClientId = $_ENV['PAYPAL_CLIENT_ID'] ?? getenv('PAYPAL_CLIENT_ID') ?: '';
$isSandbox = ($_ENV['PAYPAL_ENVIRONMENT'] ?? getenv('PAYPAL_ENVIRONMENT')) !== 'production';
$sdkHost = $isSandbox ? 'https://www.sandbox.paypal.com/sdk/js' : 'https://www.paypal.com/sdk/js';
?>
<script src="<?= htmlspecialchars($sdkHost, ENT_QUOTES) ?>?client-id=<?= urlencode($paypalClientId) ?>&currency=USD"></script>
<div id="paypal-button-container"></div>
<script>
  paypal.Buttons({
    createOrder: function () {
      return fetch('/paypal-api/checkout/orders/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: { currency_code: 'USD', value: '10.00' },
        }),
      })
        .then(function (res) { return res.json(); })
        .then(function (data) { return data.id; });
    },
    onApprove: function (data) {
      return fetch('/paypal-api/checkout/orders/capture', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderID: data.orderID }),
      }).then(function (res) { return res.json(); });
    },
  }).render('#paypal-button-container');
</script>
```

## Optional: Laravel Blade

```blade
{{-- resources/views/checkout.blade.php --}}
@php
  $sdkHost = config('services.paypal.environment') === 'production'
    ? 'https://www.paypal.com/sdk/js'
    : 'https://www.sandbox.paypal.com/sdk/js';
@endphp
<script src="{{ $sdkHost }}?client-id={{ urlencode(config('services.paypal.client_id')) }}&currency=USD"></script>
<div id="paypal-button-container"></div>
```

Keep **create** and **capture** on your server so you validate amounts and own the transaction lifecycle.
