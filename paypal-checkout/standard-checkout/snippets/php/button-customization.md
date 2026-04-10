# Button Customization — Client-Side

Customize **Smart Payment Buttons** (v5) via the `style` object on `paypal.Buttons({ ... })`. For **v6**, use component attributes or the design tokens documented for `<paypal-button>`.

## JS SDK v5 — `style` options

Common properties:

| Property | Examples | Notes |
|----------|----------|--------|
| `layout` | `vertical`, `horizontal` | Stacking vs side-by-side |
| `color` | `gold`, `blue`, `silver`, `black`, `white` | Brand palette |
| `shape` | `rect`, `pill` | Corner style |
| `label` | `paypal`, `checkout`, `pay`, `buynow` | Button label |
| `tagline` | `true`, `false` | PayPal tagline under button |
| `height` | `40`–`55` (px) | Check current min/max in docs |

```php
<?php
// Inside a template before your script block
$isSandbox = ($_ENV['PAYPAL_ENVIRONMENT'] ?? getenv('PAYPAL_ENVIRONMENT')) !== 'production';
$sdkHost = $isSandbox ? 'https://www.sandbox.paypal.com/sdk/js' : 'https://www.paypal.com/sdk/js';
$clientId = $_ENV['PAYPAL_CLIENT_ID'] ?? getenv('PAYPAL_CLIENT_ID') ?: '';
?>
<script src="<?= htmlspecialchars($sdkHost, ENT_QUOTES) ?>?client-id=<?= urlencode($clientId) ?>&currency=USD"></script>
<div id="paypal-button-container"></div>
<script>
  paypal.Buttons({
    style: {
      layout: 'vertical',
      color: 'gold',
      shape: 'rect',
      label: 'paypal',
      tagline: false,
      height: 48,
    },
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

## Multiple buttons (PayPal, Pay Later, Card)

Use separate containers or `fundingSource` per [PayPal customize docs](https://developer.paypal.com/docs/checkout/standard/customize/). Example pattern:

```javascript
paypal.Buttons({ fundingSource: paypal.FUNDING.PAYPAL, style: { color: 'gold' }, /* ... */ })
  .render('#paypal-mark');
paypal.Buttons({ fundingSource: paypal.FUNDING.PAYLATER, /* ... */ })
  .render('#paylater-mark');
```

## JS SDK v6 — web components

v6 buttons are often declarative. Example pattern (adjust to your SDK version):

```html
<paypal-button
  type="pay"
  color="gold"
  shape="rect"
></paypal-button>
```

Set `paymentSession` or equivalent in JavaScript after creating the session from `createInstance`.

## PHP note

Keep **style** in the static JS or pass a small JSON blob from PHP:

```php
<?php
$buttonStyle = [
    'layout' => 'vertical',
    'color' => 'blue',
    'shape' => 'pill',
];
?>
<script>
  const buttonStyle = <?= json_encode($buttonStyle, JSON_THROW_ON_ERROR) ?>;
  paypal.Buttons({ style: buttonStyle, /* ... */ }).render('#paypal-button-container');
</script>
```

## Optional: Laravel

```blade
<script>
  paypal.Buttons({
    style: @json([
      'layout' => 'vertical',
      'color' => 'gold',
      'shape' => 'rect',
    ]),
    // createOrder, onApprove ...
  }).render('#paypal-button-container');
</script>
```

Follow brand guidelines: do not alter PayPal marks against [acceptance use policies](https://developer.paypal.com/docs/checkout/standard/customize/).
