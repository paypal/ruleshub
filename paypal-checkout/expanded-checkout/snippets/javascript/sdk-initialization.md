# SDK Initialization — Expanded Checkout (v5 + v6 with Card Fields)

Load the PayPal JS SDK with **Card Fields** enabled, provide DOM containers for hosted fields, and use **`findEligibleMethods`** so you only show PayPal and card when supported.

## Script URLs (JS SDK v6)

| Environment | Script `src` |
|-------------|----------------|
| Sandbox | `https://www.sandbox.paypal.com/web-sdk/v6/core` |
| Production | `https://www.paypal.com/web-sdk/v6/core` |

## v6 — `createInstance` with `card-fields`

Fetch a browser-safe client token from your server, then:

```javascript
// public/checkout-expanded-v6.js
async function loadExpandedCheckoutV6() {
  const tokenRes = await fetch('/paypal-api/auth/browser-safe-client-token');
  const { accessToken: clientToken } = await tokenRes.json();

  const sdk = await window.paypal.createInstance({
    clientToken,
    components: ['paypal-payments', 'card-fields'],
    pageType: 'checkout',
  });

  const eligible = await sdk.findEligibleMethods({ currencyCode: 'USD' });

  if (eligible.isPayPalEligible) {
    // Render <paypal-button> or imperative button APIs per v6 docs
  }
  if (eligible.isCardEligible) {
    // Mount card fields (see card-fields-integration.md)
  }

  return sdk;
}
```

You may also pass **`clientId`** alongside **`clientToken`** if your integration requires it — see [JS SDK v6 configuration](https://docs.paypal.ai/developer/how-to/sdk/js/v6/configuration).

## v5 — Script tag with `card-fields`

```html
<script
  src="https://www.paypal.com/sdk/js?client-id=YOUR_CLIENT_ID&components=buttons,card-fields&currency=USD"
></script>
```

Sandbox:

```html
<script
  src="https://www.sandbox.paypal.com/sdk/js?client-id=YOUR_CLIENT_ID&components=buttons,card-fields&currency=USD"
></script>
```

## HTML — Card field containers

Provide empty elements for hosted fields (IDs are conventional; match your render code):

```html
<form id="card-form">
  <div id="card-number"></div>
  <div id="card-expiry"></div>
  <div id="card-cvv"></div>
  <div id="card-name"></div>
  <button type="submit" id="card-pay-button">Pay with card</button>
</form>
```

## v6 — `findEligibleMethods` for PayPal and card

```javascript
async function checkEligibility(sdkInstance, currencyCode) {
  const result = await sdkInstance.findEligibleMethods({ currencyCode });
  return {
    paypal: !!result?.isPayPalEligible,
    card: !!result?.isCardEligible,
    raw: result,
  };
}
```

Use the result to toggle UI sections (hide card block if not eligible).

## v5 — eligibility-style checks

v5 often uses `paypal.Buttons` and `paypal.CardFields` render callbacks; if funding is not eligible, the SDK may not display. You can still branch on your own feature flags and region.

## Common issues

| Issue | Resolution |
|-------|------------|
| Only buttons, no card | Missing `card-fields` in `components` (v5 URL or v6 array). |
| `findEligibleMethods` throws | Ensure `currencyCode` matches your order and account capabilities. |
| Wrong domain | Use sandbox script/host for sandbox client IDs. |

## Best practices

- Initialize once per page and reuse the SDK instance.
- Keep `currencyCode` consistent across eligibility, order create, and capture.
- Defer rendering card containers until containers exist in the DOM.
