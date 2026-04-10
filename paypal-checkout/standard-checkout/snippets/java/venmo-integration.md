# Venmo integration — PayPal Standard Checkout (client-side JS)

**Venmo** is available **only in the US** for eligible buyers and typically requires **USD**. Enable it in the JS SDK and, where needed, disable other funding sources so Venmo can appear per PayPal’s rules.

## v6 — server-side order (USD)

```html
<div id="venmo-button-container"></div>
<script src="https://www.paypal.com/sdk/js?client-id=YOUR_CLIENT_ID&currency=USD&enable-funding=venmo"></script>
<script>
  paypal.Buttons({
    fundingSource: paypal.FUNDING.VENMO,
    createOrder: async () => {
      const res = await fetch('/paypal-api/checkout/orders/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          intent: 'CAPTURE',
          purchase_units: [{
            amount: { currency_code: 'USD', value: '25.00' }
          }]
        })
      });
      const data = await res.json();
      return data.id;
    },
    onApprove: async (data) => {
      await fetch(
        '/paypal-api/checkout/orders/' + encodeURIComponent(data.orderID) + '/capture',
        { method: 'POST' }
      );
    },
    onError: (err) => console.error(err)
  }).render('#venmo-button-container');
</script>
```

## v6 — smart stack with Venmo enabled

```html
<script src="https://www.paypal.com/sdk/js?client-id=YOUR_CLIENT_ID&currency=USD&enable-funding=venmo"></script>
<script>
  paypal.Buttons({
    createOrder: async () => {
      const res = await fetch('/paypal-api/checkout/orders/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          intent: 'CAPTURE',
          purchase_units: [{
            amount: { currency_code: 'USD', value: '25.00' }
          }]
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

## v5 — `actions.order.create`

```html
<script src="https://www.paypal.com/sdk/js?client-id=YOUR_CLIENT_ID&currency=USD&enable-funding=venmo"></script>
<script>
  paypal.Buttons({
    fundingSource: paypal.FUNDING.VENMO,
    createOrder: function (data, actions) {
      return actions.order.create({
        purchase_units: [{
          amount: { currency_code: 'USD', value: '25.00' }
        }]
      });
    },
    onApprove: function (data, actions) {
      return actions.order.capture();
    }
  }).render('#venmo-button-container');
</script>
```

## Constraints

| Constraint | Detail |
|------------|--------|
| **Region** | US-only for consumer Venmo checkout in typical integrations |
| **Currency** | Use **USD** in `currency` query param and in order `purchase_units[].amount.currency_code` |
| **Device** | Venmo often requires mobile or supported environments; test on real devices |

## Server (Spring Boot)

No Venmo-specific Java code: your **create** and **capture** endpoints stay the same as Standard Checkout (`create-order.md`, `capture-order.md`).

## Related

- `sdk-initialization.md`, `button-customization.md`
