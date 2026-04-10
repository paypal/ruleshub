# SDK initialization — Razor / HTML / JavaScript (PayPal Standard Checkout)

Client-side loading of the PayPal JavaScript SDK and initialization patterns for **v6** (server-created orders + client token) and **v5** (Smart Payment Buttons).

Use your server route **GET** `/paypal-api/auth/browser-safe-client-token` from the client-token snippet to fetch the token before rendering buttons.

## v6 — Server-side order creation + client token

v6 expects server-created orders and secure SDK auth. Load the SDK per [PayPal Web SDK v6](https://developer.paypal.com/docs/checkout/) documentation. Pattern: fetch **browser-safe client token**, then initialize checkout and call your **create** and **capture** routes.

### `Pages/Checkout.cshtml` (Razor Page example)

```cshtml
@page
@model CheckoutModel
@{
    ViewData["Title"] = "Checkout";
    var paypalClientId = Model.PayPalClientId;
}
<div id="paypal-buttons-container"></div>

<script src="https://www.paypal.com/web-sdk/v6/core"></script>
<script>
  async function getClientToken() {
    const res = await fetch('/paypal-api/auth/browser-safe-client-token', {
      credentials: 'same-origin'
    });
    if (!res.ok) throw new Error('Failed to get client token');
    const data = await res.json();
    return data.accessToken;
  }

  async function createOrderOnServer() {
    const res = await fetch('/paypal-api/checkout/orders/create', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        currencyCode: 'USD',
        value: '10.00'
      })
    });
    if (!res.ok) throw new Error('Create order failed');
    const data = await res.json();
    return data.id;
  }

  async function captureOrderOnServer(orderId) {
    const res = await fetch('/paypal-api/checkout/orders/' + encodeURIComponent(orderId) + '/capture', {
      method: 'POST',
      credentials: 'same-origin'
    });
    if (!res.ok) throw new Error('Capture failed');
    return res.json();
  }

  (async function initPayPal() {
    const clientToken = await getClientToken();
    const sdk = await paypal.createInstance({
      clientId: '@paypalClientId',
      clientToken: clientToken
    });
    // Wire sdk sessions/buttons per current v6 docs (names may vary by release).
    // Example shape:
    // const session = await sdk.createPayPalOneTimePaymentSession({ onApprove: ... });
    // await sdk.createPayPalOneTimePaymentButton({ ... }).render('#paypal-buttons-container');
  })().catch(console.error);
</script>
```

Expose **Client ID** from configuration (not the secret) on the page model:

```csharp
public class CheckoutModel : PageModel
{
    private readonly IConfiguration _configuration;
    public string PayPalClientId => _configuration["PayPal:ClientId"] ?? "";

    public CheckoutModel(IConfiguration configuration) => _configuration = configuration;
}
```

## v5 — Smart Payment Buttons (`paypal.Buttons`)

Load `https://www.paypal.com/sdk/js` with `client-id`. Prefer **server-created orders** that match your validated totals.

### v5 with server create + capture (matches ASP.NET routes)

```html
<script src="https://www.paypal.com/sdk/js?client-id=YOUR_CLIENT_ID&currency=USD"></script>
<div id="paypal-button-container"></div>
<script>
  paypal.Buttons({
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
      const details = await res.json();
      console.log('Capture result', details);
    }
  }).render('#paypal-button-container');
</script>
```

### v5 inline (client-only create — demo only)

```javascript
paypal.Buttons({
  createOrder: function (data, actions) {
    return actions.order.create({
      purchase_units: [{
        amount: { value: '10.00', currency_code: 'USD' }
      }]
    });
  },
  onApprove: function (data, actions) {
    return actions.order.capture();
  }
}).render('#paypal-button-container');
```

## Environment

- Use **sandbox** app credentials for testing; **live** for production.
- **Sandbox API:** `https://api-m.sandbox.paypal.com`  
- **Production API:** `https://api-m.paypal.com`

## Best practices

- Always **validate** amounts and currency on the server when creating the order.
- Keep **Client ID** public; never put **Client Secret** in HTML or JS bundles.
