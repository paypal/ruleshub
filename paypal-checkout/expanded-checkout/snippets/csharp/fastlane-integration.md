# Fastlane — client JavaScript (Expanded Checkout)

**Fastlane** accelerates guest checkout when eligible. Load the SDK with the **`fastlane`** component alongside **`card-fields`** / **`paypal-payments`**, then use the Fastlane APIs from the instance returned by **`window.paypal.createInstance`**.

## Server

- Same **browser-safe client token** endpoint as Card Fields: **GET** `/paypal-api/auth/browser-safe-client-token` (see **client-token-generation.md**).
- Orders still use **POST** `/v2/checkout/orders` with **`HttpClient`** — use **`payment_source.card`** and/or **`payment_source.paypal.experience_context`** as appropriate (see **create-order.md**).

## Razor page script (v6)

```html
<script src="https://www.sandbox.paypal.com/web-sdk/v6/core"></script>
<script type="module">
  async function auth() {
    const r = await fetch('/paypal-api/auth/browser-safe-client-token', { credentials: 'same-origin' });
    const { accessToken } = await r.json();
    return { accessToken };
  }

  const sdkInstance = await window.paypal.createInstance({
    clientId: '@Model.PayPalClientId',
    components: ['paypal-payments', 'card-fields', 'fastlane'],
    pageType: 'checkout',
    auth
  });

  // Fastlane API surface is provided on sdkInstance — follow current JS SDK reference for:
  // eligibility checks, email lookup, and accelerated submit handlers.
  const fastlane = sdkInstance.Fastlane ?? sdkInstance.fastlane;
  if (fastlane) {
    await fastlane.render({ containerId: 'fastlane-container' });
  }
</script>
<div id="fastlane-container"></div>
```

## Integration notes

- **Eligibility** varies by region and buyer; always **`try/catch`** and fall back to standard Card Fields.
- Keep **create/capture** on your ASP.NET Core API; never put **ClientSecret** in the browser.
- Swap script URL to **production** `https://www.paypal.com/web-sdk/v6/core` for live.

## References

- [Fastlane (docs.paypal.ai)](https://docs.paypal.ai/payments/methods/cards/fastlane)
- [Fastlane studio](https://developer.paypal.com/studio/checkout/fastlane)
