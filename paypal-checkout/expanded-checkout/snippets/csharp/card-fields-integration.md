# Card Fields integration — client JavaScript (Expanded Checkout)

After **`window.paypal.createInstance`** (see **sdk-initialization.md**), use the SDK’s **Card Fields** APIs to render hosted fields and complete payment. The browser calls your **ASP.NET Core** routes to **create** and **capture** orders; the server uses **`payment_source.card`** and **`HttpClient`** (see **create-order.md** / **capture-order.md**).

## Prerequisites in the page

- JS SDK v6 core script loaded (sandbox or live URL).
- `createInstance` with `components: ['paypal-payments', 'card-fields']` and `auth` returning the **browser-safe client token**.

## Client module (example)

```javascript
/** @param sdkInstance - returned from window.paypal.createInstance */
export async function setupCardFields(sdkInstance, { currencyCode, createOrderUrl, captureOrderUrl }) {
  const eligible = await sdkInstance.findEligibleMethods({ currencyCode });
  if (!eligible.isCardEligible) {
    console.warn('Card Fields not eligible for this buyer/currency.');
    return;
  }

  const cardFields = await sdkInstance.createCardFields({
    style: {
      input: { 'font-size': '16px' },
      '.invalid': { color: 'red' }
    },
    createOrder: async () => {
      const res = await fetch(createOrderUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ currencyCode, value: '10.00' })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.detail || 'create order failed');
      return data.id;
    },
    onApprove: async ({ orderID }) => {
      const res = await fetch(`${captureOrderUrl}/${encodeURIComponent(orderID)}/capture`, {
        method: 'POST',
        credentials: 'same-origin'
      });
      const data = await res.json();
      if (!res.ok) throw new Error('capture failed');
      return data;
    }
  });

  await cardFields.render('#card-fields-container');
}
```

## Wiring from Razor

Point `createOrderUrl` and `captureOrderUrl` at your API:

- `POST /paypal-api/checkout/orders/create` — body matches **`CreateExpandedOrderRequest`** (server adds **`payment_source.card`**).
- `POST /paypal-api/checkout/orders/{orderId}/capture`

```html
<script type="module">
  import { setupCardFields } from '/js/checkout-expanded/card-fields.js';

  const accessToken = /* from /paypal-api/auth/browser-safe-client-token */;
  const sdkInstance = await window.paypal.createInstance({
    clientId: '@Model.PayPalClientId',
    components: ['paypal-payments', 'card-fields'],
    pageType: 'checkout',
    auth: async () => ({ accessToken })
  });

  await setupCardFields(sdkInstance, {
    currencyCode: 'USD',
    createOrderUrl: '/paypal-api/checkout/orders/create',
    captureOrderUrl: '/paypal-api/checkout/orders'
  });
</script>
```

## 3D Secure

When the issuer requires SCA, the SDK may present a challenge; your server should create orders with **`payment_source.card.attributes.verification.method`** set to **`SCA_WHEN_REQUIRED`** (see **create-order.md** and **3ds-integration.md**).

## REST hosts (server)

- Sandbox: `https://api-m.sandbox.paypal.com`
- Production: `https://api-m.paypal.com`
