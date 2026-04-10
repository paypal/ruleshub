# Button customization — PayPal Standard Checkout (JS SDK v5 and v6)

Customize **labels**, **colors**, **shapes**, and **layout** through `paypal.Buttons({ ... })` and optional SDK query parameters. Styles apply to the rendered Smart Payment Buttons.

## v6 — common options

```html
<script src="https://www.paypal.com/sdk/js?client-id=YOUR_CLIENT_ID&currency=USD"></script>
<div id="paypal-button-container"></div>
<script>
  paypal.Buttons({
    style: {
      layout: 'vertical',
      color: 'gold',
      shape: 'rect',
      label: 'paypal',
      height: 45,
      tagline: false
    },
    createOrder: async () => {
      const res = await fetch('/paypal-api/checkout/orders/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          intent: 'CAPTURE',
          purchase_units: [{ amount: { currency_code: 'USD', value: '10.00' } }]
        })
      });
      return (await res.json()).id;
    },
    onApprove: async (data) => {
      await fetch('/paypal-api/checkout/orders/' + encodeURIComponent(data.orderID) + '/capture', {
        method: 'POST'
      });
    }
  }).render('#paypal-button-container');
</script>
```

### Style fields (typical)

| Field | Examples / notes |
|-------|-------------------|
| `layout` | `vertical`, `horizontal` |
| `color` | `gold`, `blue`, `silver`, `black`, `white` (availability may vary by funding source) |
| `shape` | `rect`, `pill` |
| `label` | `paypal`, `checkout`, `buynow`, `pay` |
| `height` | Pixel height (e.g. `40`–`55`) |
| `tagline` | `true` / `false` |

Refer to the [PayPal JS SDK style documentation](https://developer.paypal.com/sdk/js/reference/#style) for the latest allowed values.

## v6 — multiple buttons (PayPal + debit/credit)

```javascript
paypal.Buttons({ /* style + createOrder + onApprove */ }).render('#paypal-button-container');
paypal.Buttons({
  fundingSource: paypal.FUNDING.CARD,
  style: { layout: 'vertical', color: 'black' },
  createOrder: async () => { /* same createOrder as above */ },
  onApprove: async (data) => { /* same capture */ }
}).render('#card-button-container');
```

## v5 — same `style` object

```html
<script src="https://www.paypal.com/sdk/js?client-id=YOUR_CLIENT_ID&currency=USD"></script>
<script>
  paypal.Buttons({
    style: {
      layout: 'horizontal',
      color: 'gold',
      shape: 'pill',
      label: 'checkout',
      height: 48
    },
    createOrder: function (data, actions) {
      return actions.order.create({
        purchase_units: [{ amount: { value: '10.00', currency_code: 'USD' } }]
      });
    },
    onApprove: function (data, actions) {
      return actions.order.capture();
    }
  }).render('#paypal-button-container');
</script>
```

## Disabling funding in the stack

Use SDK parameters such as `disable-funding=card` or `enable-funding=venmo` on the script URL (see current SDK docs). Programmatically, pass `fundingSource` when rendering a **single** funding source button.

## Spring Boot / Thymeleaf

Pass only **client-id** and **currency** from the server; keep **style** in static JS or a small inline block for maintainability.

```html
<script th:src="@{https://www.paypal.com/sdk/js(client-id=${paypalClientId},currency='USD')}"></script>
```

## Related

- `sdk-initialization.md`, `pay-later-integration.md`, `venmo-integration.md`
