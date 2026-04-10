# Venmo Integration — Client-Side JavaScript

**Venmo** is enabled through the PayPal JS SDK for the US mobile web flow when your account and buyer profile support it. Use **`enable-funding=venmo`** (v5) or the Venmo component (v6) alongside the PayPal button.

## JS SDK v5 — Venmo funding

```php
<?php
$paypalClientId = $_ENV['PAYPAL_CLIENT_ID'] ?? getenv('PAYPAL_CLIENT_ID') ?: '';
$isSandbox = ($_ENV['PAYPAL_ENVIRONMENT'] ?? getenv('PAYPAL_ENVIRONMENT')) !== 'production';
$sdkHost = $isSandbox ? 'https://www.sandbox.paypal.com/sdk/js' : 'https://www.paypal.com/sdk/js';
$query = http_build_query([
    'client-id' => $paypalClientId,
    'currency' => 'USD',
    'enable-funding' => 'venmo',
]);
?>
<script src="<?= htmlspecialchars($sdkHost . '?' . $query, ENT_QUOTES) ?>"></script>
<div id="venmo-button-container"></div>
<div id="paypal-button-container"></div>
<script>
  paypal.Buttons({
    fundingSource: paypal.FUNDING.VENMO,
    createOrder: function () {
      return fetch('/paypal-api/checkout/orders/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: { currency_code: 'USD', value: '10.00' },
        }),
      })
        .then(function (r) { return r.json(); })
        .then(function (d) { return d.id; });
    },
    onApprove: function (data) {
      return fetch('/paypal-api/checkout/orders/capture', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderID: data.orderID }),
      }).then(function (r) { return r.json(); });
    },
  }).render('#venmo-button-container');

  paypal.Buttons({
    createOrder: function () {
      return fetch('/paypal-api/checkout/orders/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: { currency_code: 'USD', value: '10.00' },
        }),
      })
        .then(function (r) { return r.json(); })
        .then(function (d) { return d.id; });
    },
    onApprove: function (data) {
      return fetch('/paypal-api/checkout/orders/capture', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderID: data.orderID }),
      }).then(function (r) { return r.json(); });
    },
  }).render('#paypal-button-container');
</script>
```

Venmo often appears on **mobile Safari/Chrome**; desktop may show PayPal only. Test on real devices and sandbox buyer accounts.

## JS SDK v6

Include Venmo in `components` when supported by your SDK build, then mount the Venmo-specific element (naming follows [v6 docs](https://docs.paypal.ai/)):

```javascript
const sdk = await window.paypal.createInstance({
  clientId: 'YOUR_CLIENT_ID',
  components: ['paypal-payments', 'venmo'],
  pageType: 'checkout',
});
```

Wire the same `createOrder` / `onApprove` handlers to your PHP endpoints.

## Server-side

Same **create order** and **capture** routes as standard checkout. No Venmo-specific REST path in your PHP layer.

## Optional: Laravel Blade

```blade
@php
  $sdk = config('services.paypal.environment') === 'production'
    ? 'https://www.paypal.com/sdk/js'
    : 'https://www.sandbox.paypal.com/sdk/js';
@endphp
<script src="{{ $sdk }}?client-id={{ urlencode(config('services.paypal.client_id')) }}&currency=USD&enable-funding=venmo"></script>
```

Ensure **HTTPS** and a supported **domain** for Venmo; PayPal documents required setup in the developer dashboard.
