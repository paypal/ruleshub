# Pay Later Integration — Client-Side JavaScript

**Pay Later** (PayPal Credit / regional Pay Later products) is surfaced through the same PayPal JS SDK when enabled for your account and region. You mainly **enable funding** on the SDK and optionally render a dedicated Pay Later button.

## JS SDK v5 — enable Pay Later

Add `enable-funding=paylater` to the script URL (and disable others if you need a narrow funnel). Use your PHP template to build the query string.

```php
<?php
$paypalClientId = $_ENV['PAYPAL_CLIENT_ID'] ?? getenv('PAYPAL_CLIENT_ID') ?: '';
$isSandbox = ($_ENV['PAYPAL_ENVIRONMENT'] ?? getenv('PAYPAL_ENVIRONMENT')) !== 'production';
$sdkHost = $isSandbox ? 'https://www.sandbox.paypal.com/sdk/js' : 'https://www.paypal.com/sdk/js';
$query = http_build_query([
    'client-id' => $paypalClientId,
    'currency' => 'USD',
    'enable-funding' => 'paylater',
    'disable-funding' => 'card',
]);
?>
<script src="<?= htmlspecialchars($sdkHost . '?' . $query, ENT_QUOTES) ?>"></script>
<div id="paypal-button-container"></div>
<script>
  paypal.Buttons({
    fundingSource: paypal.FUNDING.PAYLATER,
    style: { layout: 'vertical', label: 'pay' },
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

If Pay Later is not offered for the buyer or region, PayPal may hide or alter the button; handle that gracefully in UX.

## JS SDK v6 — Pay Later web component

Load v6 core (sandbox vs live per environment), then include the Pay Later component and render `<paypal-pay-later-button>` alongside `<paypal-button>` when your integration supports it.

```html
<script src="https://www.sandbox.paypal.com/web-sdk/v6/core"></script>
<script type="module">
  const sdk = await window.paypal.createInstance({
    clientId: 'YOUR_CLIENT_ID',
    components: ['paypal-payments', 'pay-later'],
    pageType: 'checkout',
  });

  const session = await sdk.createPayPalOneTimePaymentSession({
    async createOrder() { /* fetch /paypal-api/checkout/orders/create */ },
    async onApprove({ orderID }) { /* POST /paypal-api/checkout/orders/capture */ },
  });

  const payLater = document.createElement('paypal-pay-later-button');
  payLater.paymentSession = session;
  document.getElementById('wallet').appendChild(payLater);
</script>
```

Exact component names and session APIs follow the [JS SDK v6 Pay Later](https://docs.paypal.ai/) documentation for your SDK version.

## Server-side

No separate Pay Later REST endpoint: your existing **create order** and **capture** endpoints apply. Ensure **currency** and **country** match your Pay Later eligibility.

## Optional: Laravel

Pass flags from config into Blade:

```blade
@php
  $sdk = config('services.paypal.environment') === 'production'
    ? 'https://www.paypal.com/sdk/js'
    : 'https://www.sandbox.paypal.com/sdk/js';
  $q = http_build_query([
    'client-id' => config('services.paypal.client_id'),
    'currency' => 'USD',
    'enable-funding' => 'paylater',
  ]);
@endphp
<script src="{{ $sdk }}?{{ $q }}"></script>
```
