# Pay Later integration — client-side JavaScript (Standard Checkout)

**Pay Later** (Pay in 4, Pay Monthly where available) is enabled when the buyer is eligible and your integration exposes the funding source. On the client, include **`enable-funding=paylater`** (v5 SDK query) or the equivalent v6 funding configuration so the Pay Later option can appear alongside PayPal.

Server-side: create orders as usual; no separate Pay Later server endpoint is required for basic Standard Checkout.

## v5 — Load script with Pay Later funding

```html
<script src="https://www.paypal.com/sdk/js?client-id=YOUR_CLIENT_ID&currency=USD&enable-funding=paylater"></script>
<div id="paypal-button-container"></div>
<script>
  paypal.Buttons({
    fundingSource: paypal.FUNDING.PAYLATER,
    createOrder: async function () {
      const res = await fetch('/paypal-api/checkout/orders/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currencyCode: 'USD', value: '10.00' })
      });
      const data = await res.json();
      return data.id;
    },
    onApprove: async function (data) {
      const res = await fetch('/paypal-api/checkout/orders/' + encodeURIComponent(data.orderID) + '/capture', {
        method: 'POST'
      });
      return res.json();
    }
  }).render('#paypal-button-container');
</script>
```

### Optional: separate PayPal and Pay Later buttons

Render two button instances: one with default funding (PayPal) and one with `paypal.FUNDING.PAYLATER`, or rely on a single Smart Payment Buttons stack that shows eligible methods automatically when **`enable-funding=paylater`** is set.

```javascript
paypal.Buttons({ /* PayPal wallet */ }).render('#paypal-wallet');
paypal.Buttons({ fundingSource: paypal.FUNDING.PAYLATER, /* same createOrder/onApprove */ })
  .render('#paylater-button-container');
```

## v6 — Enable Pay Later in checkout session

Follow the current v6 documentation for **funding sources** / **Pay Later** on your `createInstance` + payment session. Conceptually:

- Pass the same **client ID** and **browser-safe client token** from your ASP.NET routes.
- Configure the session or button so **Pay Later** is not disabled; use SDK constants (e.g. `paypal.FUNDING.PAYLATER`) per the version you load.

```javascript
// Pseudocode — align with official v6 API names for your SDK build.
const sdk = await paypal.createInstance({ clientId, clientToken });
// Ensure Pay Later is allowed in the session options (see PayPal v6 docs).
```

## Messaging (optional)

PayPal provides **messaging components** (on-site messaging) with separate script tags and configuration for installment disclosures. Add only if your compliance and marketing teams require them; see PayPal’s messaging integration guides.

## Currency and eligibility

- Pay Later availability depends on **buyer country**, **currency**, **merchant account**, and **transaction amount**.
- Always **validate** amount and currency on the server in **POST** `/paypal-api/checkout/orders/create`.

## REST APIs (server)

- **Sandbox:** `https://api-m.sandbox.paypal.com`
- **Production:** `https://api-m.paypal.com`
