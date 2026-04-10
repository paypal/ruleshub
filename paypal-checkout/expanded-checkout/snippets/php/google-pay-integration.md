# Google Pay — Client JavaScript (Expanded Checkout)

**Google Pay** with PayPal is integrated through the PayPal **JS SDK** using the **`googlepay-payments`** component (v6). Your **PHP** backend handles **OAuth**, **browser-safe client tokens**, and **Orders** create/capture.

## Script (JS SDK v6)

| Environment | Core script |
|-------------|-------------|
| Sandbox | `https://www.sandbox.paypal.com/web-sdk/v6/core` |
| Production | `https://www.paypal.com/web-sdk/v6/core` |

```javascript
const sdk = await window.paypal.createInstance({
  clientId: 'YOUR_CLIENT_ID',
  clientToken,
  components: ['paypal-payments', 'card-fields', 'googlepay-payments'],
  pageType: 'checkout',
});

const eligible = await sdk.findEligibleMethods({ currencyCode: 'USD' });
// Render Google Pay per current SDK when eligible (property names per docs)
```

## JS SDK v5

```html
<script
  src="https://www.sandbox.paypal.com/sdk/js?client-id=CLIENT_ID&components=buttons,googlepay&currency=USD"
></script>
```

Parameter values (`googlepay`, `googlepay-buttons`, etc.) depend on SDK version — confirm against [JS SDK configuration](https://developer.paypal.com/sdk/js/configuration/).

## PHP backend

| Step | Reference |
|------|-----------|
| Browser-safe token | `client-token-generation.md` |
| Create order | Use **`payment_source.paypal.experience_context`** for PayPal wallet flows — **not** deprecated `application_context`; card flows use **`payment_source.card`** — `create-order.md` |
| Capture | `capture-order.md` |

## Documentation

- [Google Pay (docs.paypal.ai)](https://docs.paypal.ai/payments/methods/digital-wallets/google-pay)
- [Google Pay — developer.paypal.com](https://developer.paypal.com/docs/checkout/apm/google-pay/)

## Notes

- Ensure **Google Pay** is enabled for your PayPal account and region.
- Align **amount**, **currency**, and **country** between eligibility, order create, and capture.
