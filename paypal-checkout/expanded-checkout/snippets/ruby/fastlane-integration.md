# Fastlane Integration — Client JS (Ruby app serves assets)

**Fastlane** accelerates guest checkout when eligible. Load the **`fastlane`** component with the JS SDK and follow PayPal’s Fastlane docs for fields, callbacks, and eligibility.

REST API (orders, vault) uses:

| Environment | Base URL |
|-------------|----------|
| Sandbox | `https://api-m.sandbox.paypal.com` |
| Production | `https://api-m.paypal.com` |

Server-side order creation still uses **`payment_source`** with **`experience_context`** (see **`create-order.md`**) — **not** `application_context`.

---

## v6 — `createInstance` with `fastlane`

```javascript
// public/checkout-fastlane.js
async function initFastlane() {
  const tokenRes = await fetch('/paypal-api/auth/browser-safe-client-token');
  const { accessToken: clientToken } = await tokenRes.json();

  const sdk = await window.paypal.createInstance({
    clientId: window.__PAYPAL_CLIENT_ID__,
    clientToken,
    components: ['paypal-payments', 'card-fields', 'fastlane'],
    pageType: 'checkout',
  });

  const eligible = await sdk.findEligibleMethods({ currencyCode: 'USD' });
  if (!eligible?.isFastlaneEligible) {
    console.info('Fastlane not eligible; fallback to standard card / PayPal');
    return { sdk, fastlane: null };
  }

  // Use sdk.Fastlane or documented factory — names follow PayPal JS SDK v6 reference
  // const fastlane = await sdk.Fastlane({ ... });
  return { sdk, fastlane: null };
}
```

> **Note:** Replace the placeholder with the exact API from [Fastlane integration](https://docs.paypal.ai/payments/methods/cards/fastlane) / [Studio Fastlane](https://developer.paypal.com/studio/checkout/fastlane) for your SDK version.

---

## v5 — script tag

Add `components=fastlane` (and other components you need):

```html
<script
  src="https://www.paypal.com/sdk/js?client-id=YOUR_CLIENT_ID&components=buttons,card-fields,fastlane&currency=USD"
></script>
```

Sandbox host: `https://www.sandbox.paypal.com/sdk/js?...`

---

## Ruby backend

- Reuse **`GET /paypal-api/auth/browser-safe-client-token`** (`client-token-generation.md`).
- **`POST /paypal-api/checkout/orders/create`** should set **`payment_source.paypal`** or **`payment_source.card`** per the buyer’s chosen instrument; Fastlane still completes through the same Orders v2 capture path.

Example PayPal wallet path uses:

```ruby
payment_source: {
  paypal: {
    experience_context: {
      shipping_preference: "GET_FROM_FILE",
      user_action: "PAY_NOW",
      return_url: "#{base_url}/checkout/return",
      cancel_url: "#{base_url}/checkout/cancel"
    }
  }
}
```

Tune **`shipping_preference`** to your checkout (physical vs digital).

---

## Rails notes

- Serve Fastlane JS via Webpack/importmap; keep **client ID** public, secrets server-only.
- Feature-flag Fastlane by region using your own rules **and** `findEligibleMethods`.

## Best practices

- Always provide a non-Fastlane fallback UI.
- Log **PayPal-Debug-Id** on order errors.

## Common issues

| Issue | Fix |
|-------|-----|
| Component missing | Add `fastlane` to SDK `components` |
| Not eligible | Expected in some regions — fallback |
