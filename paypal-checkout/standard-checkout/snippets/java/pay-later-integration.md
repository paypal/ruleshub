# Pay Later integration — PayPal Standard Checkout (client-side JS)

**Pay Later** (Pay in 4, Pay Monthly where available) is enabled through the **PayPal JS SDK** when the buyer is eligible and the integration uses supported **currency** and **country**. No separate server endpoint is required beyond your normal **create order** and **capture** flows.

**Requirements (typical):** correct **currency** (e.g. USD), buyer/market eligibility, and a **client ID** with Pay Later enabled. Consult current PayPal docs for regional availability.

## v6 — server-side order creation

Pay Later uses the same `paypal.Buttons` flow; funding sources appear in the wallet when eligible.

```html
<div id="paypal-button-container"></div>
<script src="https://www.paypal.com/sdk/js?client-id=YOUR_CLIENT_ID&currency=USD&enable-funding=paylater"></script>
<script>
  paypal.Buttons({
    fundingSource: paypal.FUNDING.PAYLATER,
    createOrder: async () => {
      const res = await fetch('/paypal-api/checkout/orders/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          intent: 'CAPTURE',
          purchase_units: [{
            amount: { currency_code: 'USD', value: '99.00' }
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
    }
  }).render('#paypal-button-container');
</script>
```

**Notes:**

- `enable-funding=paylater` helps surface Pay Later in the SDK configuration (see current [SDK reference](https://developer.paypal.com/sdk/js/configuration/) for supported query params).
- You can render a **dedicated** Pay Later button with `fundingSource: paypal.FUNDING.PAYLATER` **or** let the smart stack show eligible options.

## v6 — smart stack (default)

Omit `fundingSource` to allow PayPal to show PayPal balance, card, and Pay Later when eligible:

```html
<script src="https://www.paypal.com/sdk/js?client-id=YOUR_CLIENT_ID&currency=USD"></script>
```

## v5 — `actions.order.create`

```html
<script src="https://www.paypal.com/sdk/js?client-id=YOUR_CLIENT_ID&currency=USD&enable-funding=paylater"></script>
<script>
  paypal.Buttons({
    fundingSource: paypal.FUNDING.PAYLATER,
    createOrder: function (data, actions) {
      return actions.order.create({
        purchase_units: [{
          amount: { currency_code: 'USD', value: '99.00' }
        }]
      });
    },
    onApprove: function (data, actions) {
      return actions.order.capture();
    }
  }).render('#paypal-button-container');
</script>
```

## Server-side reminders

- Amounts and currency on **create order** must match what you display to the buyer.
- Use **HTTPS** in production.
- For **v6** server-driven orders, always validate totals on the server (`create-order.md`).

## Related

- Button styling: `button-customization.md`
- SDK load: `sdk-initialization.md`
