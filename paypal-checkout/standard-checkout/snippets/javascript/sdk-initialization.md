# SDK Initialization (Client-Side) — Standard Checkout

Standard Checkout supports **JS SDK v5** (classic script + `paypal.Buttons`) and **v6** (web components + `createInstance`). Choose one approach per page; v6 is recommended for new work.

## v6 — HTML structure (script + web components)

Sandbox script URL:

```html
<script
  async
  src="https://www.sandbox.paypal.com/web-sdk/v6/core"
  onload="onPayPalWebSdkLoaded()"></script>
```

Live:

```html
<script
  async
  src="https://www.paypal.com/web-sdk/v6/core"
  onload="onPayPalWebSdkLoaded()"></script>
```

Example markup:

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <title>Checkout</title>
  </head>
  <body>
    <div id="loading">Loading payments…</div>
    <paypal-button id="paypal-button" type="pay" hidden></paypal-button>
    <script src="./checkout.js"></script>
    <script
      async
      src="https://www.sandbox.paypal.com/web-sdk/v6/core"
      onload="onPayPalWebSdkLoaded()"></script>
  </body>
</html>
```

## v6 — `getBrowserSafeClientToken()` and `onPayPalWebSdkLoaded()`

```javascript
// checkout.js

async function getBrowserSafeClientToken() {
  const response = await fetch('/paypal-api/auth/browser-safe-client-token');
  const contentType = response.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) {
    throw new Error('Expected JSON from client token endpoint');
  }
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.message || `Token HTTP ${response.status}`);
  }
  const { accessToken } = await response.json();
  if (!accessToken) throw new Error('Missing accessToken');
  return accessToken;
}

async function onPayPalWebSdkLoaded() {
  try {
    const clientToken = await getBrowserSafeClientToken();
    const sdkInstance = await window.paypal.createInstance({
      clientToken,
      components: ['paypal-payments'],
      pageType: 'checkout',
    });

    const eligible = await sdkInstance.findEligibleMethods({
      currencyCode: 'USD',
    });
    if (eligible.isEligible('paypal')) {
      document.getElementById('paypal-button').hidden = false;
      // Wire session / click handlers per your integration (see create-order snippet)
    }
    document.getElementById('loading').hidden = true;
  } catch (e) {
    console.error(e);
    document.getElementById('loading').textContent = 'Payments unavailable.';
  }
}
```

## v6 — Eligibility with `findEligibleMethods()`

```javascript
const eligibleMethods = await sdkInstance.findEligibleMethods({
  currencyCode: 'USD',
  countryCode: 'US', // optional; helps Venmo / regional methods
});

if (eligibleMethods.isEligible('paypal')) {
  /* show PayPal */
}
```

## v5 — `paypal.Buttons().render()`

Load the v5 SDK with your **client id** in the query string (v5 pattern; do not put secrets other than public client id):

```html
<script src="https://www.paypal.com/sdk/js?client-id=YOUR_CLIENT_ID&currency=USD"></script>
<div id="paypal-button-container"></div>
```

```javascript
paypal
  .Buttons({
    createOrder: async () => {
      const res = await fetch('/paypal-api/checkout/orders/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: '10.00', currency: 'USD' }),
      });
      const { id } = await res.json();
      return id;
    },
    onApprove: async (data) => {
      await fetch(`/paypal-api/checkout/orders/${data.orderID}/capture`, {
        method: 'POST',
      });
    },
    onError: (err) => console.error(err),
  })
  .render('#paypal-button-container');
```

For **v6**, prefer **server-created orders** and the session APIs documented with your integration (see `create-order.md`).

## TypeScript — typed globals (optional)

```typescript
// paypal.d.ts — minimal
interface PayPalNamespace {
  createInstance(options: {
    clientToken: string;
    components: string[];
    pageType?: string;
    locale?: string;
  }): Promise<{
    findEligibleMethods(opts: {
      currencyCode: string;
      countryCode?: string;
    }): Promise<{ isEligible(method: string): boolean }>;
  }>;
}

declare global {
  interface Window {
    paypal: PayPalNamespace;
  }
}

export {};
```

## Common issues

| Issue | Resolution |
|-------|------------|
| `createInstance` undefined | Ensure v6 script loaded before calling; use `onload` |
| CORS | Allow your site origin on the server |
| Wrong sandbox vs live | Match script host and server `PAYPAL_ENVIRONMENT` |

## Best practices

- Initialize after script `onload` (or dynamic import) to avoid race conditions.
- Hide buttons until eligibility succeeds to reduce confusing UX.
- Keep **all** order amounts authoritative on the **server**.
