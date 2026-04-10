# Venmo integration — client-side JavaScript (Standard Checkout)

**Venmo** is available to eligible US buyers on supported platforms. Enable it on the JS SDK and render a Venmo button or eligible funding stack.

## Requirements

- Typically **US** merchants and buyers, **USD**, and supported user agents (often mobile WebView / in-app browser patterns). See current PayPal Venmo docs for eligibility.
- Your ASP.NET server flow stays the same: **create order** → **capture** (or authorize flow).

## v5 — Enable Venmo on the SDK

```html
<script src="https://www.paypal.com/sdk/js?client-id=YOUR_CLIENT_ID&currency=USD&enable-funding=venmo"></script>
<div id="venmo-button-container"></div>
<script>
  paypal.Buttons({
    fundingSource: paypal.FUNDING.VENMO,
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
  }).render('#venmo-button-container');
</script>
```

### Combined funding (PayPal + Venmo + others)

Omit `fundingSource` on the main button to let the SDK show eligible methods, while **`enable-funding=venmo`** adds Venmo to the eligible set:

```html
<script src="https://www.paypal.com/sdk/js?client-id=YOUR_CLIENT_ID&currency=USD&enable-funding=venmo"></script>
```

## v6

Use the v6 Web SDK pattern from **sdk-initialization.md** and enable **Venmo** per the current v6 funding API (e.g. include Venmo in allowed funding sources / button configuration). Fetch **client token** from **GET** `/paypal-api/auth/browser-safe-client-token` as with other v6 flows.

```javascript
// Align with PayPal v6 docs: Venmo funding constant / session option.
// const fundingSource = paypal.FUNDING.VENMO;
```

## Deep linking and returns

Venmo may redirect through the Venmo app or browser. Ensure your **return URLs** and **mobile site** work over **HTTPS**. Handle **`onCancel`** and **`onError`** on `paypal.Buttons` for a complete UX.

## Server routes (unchanged)

| Route | Purpose |
|-------|---------|
| `POST /paypal-api/checkout/orders/create` | Create order |
| `POST /paypal-api/checkout/orders/{orderId}/capture` | Capture |

## REST base URLs (server-to-server)

- **Sandbox:** `https://api-m.sandbox.paypal.com`
- **Production:** `https://api-m.paypal.com`
