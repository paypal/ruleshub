# Fastlane — Client JavaScript (Expanded Checkout)

**Fastlane** accelerates guest checkout by reusing verified buyer profile data where eligible. Integration is primarily **client-side** via the PayPal JS SDK with the **`fastlane`** component; your **PHP** backend still issues **OAuth**, **client tokens**, and **Orders** APIs as for other Expanded Checkout flows.

## Load Fastlane (JS SDK v6 pattern)

Include the v6 core script (sandbox vs live host), then add **`fastlane`** to **`components`** when calling **`createInstance`**.

```javascript
// After fetching browser-safe client token from your PHP endpoint (see client-token-generation.md)
const sdk = await window.paypal.createInstance({
  clientId: 'YOUR_CLIENT_ID',
  clientToken,
  components: ['paypal-payments', 'card-fields', 'fastlane'],
  pageType: 'checkout',
});

const eligible = await sdk.findEligibleMethods({ currencyCode: 'USD' });
// Use Fastlane APIs per current docs when eligible
```

## JS SDK v5

If you use v5, load the SDK with **`components=buttons,card-fields,fastlane`** (exact parameter names follow [JS SDK configuration](https://developer.paypal.com/sdk/js/configuration/)).

```html
<script
  src="https://www.sandbox.paypal.com/sdk/js?client-id=CLIENT_ID&components=buttons,card-fields,fastlane&currency=USD"
></script>
```

## PHP backend role

- **GET** `/paypal-api/auth/browser-safe-client-token` — same **`response_type=client_token&intent=sdk_init`** as Card Fields.
- **POST** `/v2/checkout/orders` — use **`payment_source.paypal.experience_context`** or **`payment_source.card`** as appropriate; **never** deprecated top-level **`application_context`**.
- **POST** `/v2/checkout/orders/{id}/capture` — after Fastlane + SDK approval path completes.

## Documentation

- [Fastlane (docs.paypal.ai)](https://docs.paypal.ai/payments/methods/cards/fastlane)
- [Fastlane Studio](https://developer.paypal.com/studio/checkout/fastlane)

## Notes

- **Eligibility** can vary by region, currency, and buyer; always **`findEligibleMethods`** (v6) or equivalent checks before showing Fastlane UI.
- Keep **Fastlane** UI consistent with your branding guidelines from PayPal documentation.
