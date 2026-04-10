# Apple Pay — Client JavaScript (Expanded Checkout)

**Apple Pay** with PayPal uses the **JS SDK** with the **`applepay-payments`** component (v6). Your **PHP** server provides **OAuth**, **client token**, and **Orders** create/capture; wallet selection and Apple Pay sheets run in the **browser**.

## Script (JS SDK v6)

| Environment | Core script |
|-------------|-------------|
| Sandbox | `https://www.sandbox.paypal.com/web-sdk/v6/core` |
| Production | `https://www.paypal.com/web-sdk/v6/core` |

Initialize with **`applepay-payments`** (and other components you need):

```javascript
const sdk = await window.paypal.createInstance({
  clientId: 'YOUR_CLIENT_ID',
  clientToken,
  components: ['paypal-payments', 'card-fields', 'applepay-payments'],
  pageType: 'checkout',
});

const eligible = await sdk.findEligibleMethods({ currencyCode: 'USD' });
```

## JS SDK v5

```html
<script
  src="https://www.sandbox.paypal.com/sdk/js?client-id=CLIENT_ID&components=buttons,applepay-buttons&currency=USD"
></script>
```

## PHP backend

- **Client token:** `client-token-generation.md`
- **Create order:** **`payment_source.paypal.experience_context`** for wallet flows (not deprecated `application_context`) — `create-order.md`
- **Capture:** `capture-order.md`

## Domain registration

- [Apple Pay (docs.paypal.ai)](https://docs.paypal.ai/payments/methods/digital-wallets/apple-pay)
- [Apple Pay — developer.paypal.com](https://developer.paypal.com/docs/checkout/apm/apple-pay/)

## Notes

- Web Apple Pay targets **Safari** and supported environments.
- Align **currency** and capabilities across eligibility, order create, and capture.
