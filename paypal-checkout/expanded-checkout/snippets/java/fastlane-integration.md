# Fastlane — Client JavaScript (Expanded Checkout)

Fastlane accelerates guest checkout. The browser uses the PayPal SDK (**`fastlane`** component in v6, or documented v5 patterns) and still relies on your **Spring Boot** APIs for **OAuth**, **Orders**, and **capture**.

**REST bases (server):** Sandbox `https://api-m.sandbox.paypal.com`, Production `https://api-m.paypal.com`.

## JS SDK v6 — include `fastlane`

```html
<script src="https://www.sandbox.paypal.com/web-sdk/v6/core"></script>
```

```javascript
async function initFastlane(clientId, clientToken) {
  const sdkInstance = await window.paypal.createInstance({
    clientId,
    clientToken,
    components: ['fastlane', 'paypal-payments', 'card-fields'],
    pageType: 'checkout'
  });

  const fastlane = await sdkInstance.createFastlane();
  // Follow PayPal Fastlane docs for: identity / profile / shipping callbacks

  await fastlane.render('#fastlane-container', {
    shippingAddress: { /* optional defaults */ },
    onApprove: async (data) => {
      const orderId = data.orderID;
      await fetch(`/api/paypal/orders/${orderId}/capture`, { method: 'POST' });
    },
    createOrder: async () => {
      const res = await fetch('/api/paypal/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          intent: 'CAPTURE',
          currencyCode: 'USD',
          value: '25.00'
        })
      });
      const j = await res.json();
      return j.id;
    }
  });
}
```

## Single-use token (when required by your integration)

Some Fastlane flows pass a **`singleUseToken`** from the client to the server. Your Spring **`POST /v2/checkout/orders`** body should place it under **`payment_source.card`** per current PayPal docs (field name may be **`single_use_token`** / **`singleUseToken`** depending on API version — confirm against [Orders v2](https://developer.paypal.com/docs/api/orders/v2/) for your integration date).

Example server-side fragment (conceptual JSON only):

```json
{
  "intent": "CAPTURE",
  "purchase_units": [{ "amount": { "currency_code": "USD", "value": "25.00" } }],
  "payment_source": {
    "card": {
      "single_use_token": "TOKEN_FROM_FASTLANE"
    }
  }
}
```

Replace with the exact property name PayPal documents for your SDK version.

## Spring Boot

- Reuse **`PayPalOrdersClient`** from `create-order.md` / `capture-order.md`.
- Ensure **`GET /api/paypal/client-token`** returns a client token with `intent=sdk_init` (`client-token-generation.md`).

## References

- [Fastlane — developer.paypal.com](https://developer.paypal.com/studio/checkout/fastlane)
- [Fastlane — docs.paypal.ai](https://docs.paypal.ai/payments/methods/cards/fastlane)
