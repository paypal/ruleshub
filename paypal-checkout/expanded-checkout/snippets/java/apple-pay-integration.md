# Apple Pay — Client JS + server notes (PayPal Expanded Checkout)

Apple Pay runs through the PayPal JS SDK (**`applepay-payments`** in v6). Your **Spring Boot** app still creates and captures **Orders** via `HttpClient`; wallets use their own **`payment_source`** shape.

**REST bases:** Sandbox `https://api-m.sandbox.paypal.com`, Production `https://api-m.paypal.com`.

## Requirements

- Register the Apple Pay domain with PayPal; host **`/.well-known/apple-developer-merchantid-domain-association`**.
- HTTPS in production; test Safari / Apple devices.
- [Apple Pay with PayPal](https://developer.paypal.com/docs/checkout/apm/apple-pay/)

## JS SDK v6 — initialize with Apple Pay

```html
<script src="https://www.sandbox.paypal.com/web-sdk/v6/core"></script>
```

```javascript
async function initApplePay(clientId, clientToken) {
  const sdkInstance = await window.paypal.createInstance({
    clientId,
    clientToken,
    components: ['applepay-payments', 'paypal-payments'],
    pageType: 'checkout'
  });

  const eligible = await sdkInstance.findEligibleMethods({ currencyCode: 'USD' });
  if (!eligible.isEligible('applepay')) {
    document.getElementById('apple-pay-container').style.display = 'none';
    return;
  }

  const applePay = await sdkInstance.createApplePay();
  await applePay.render('#apple-pay-container', {
    createOrder: async () => {
      const res = await fetch('/api/paypal/orders/apple-pay', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currencyCode: 'USD', value: '15.00' })
      });
      return (await res.json()).id;
    },
    onApprove: async (data) => {
      await fetch(`/api/paypal/orders/${data.orderID}/capture`, { method: 'POST' });
    }
  });
}
```

Exact method names follow the current v6 Apple Pay API — align with [docs.paypal.ai Apple Pay](https://docs.paypal.ai/payments/methods/digital-wallets/apple-pay).

## Server — create order with `payment_source.apple_pay`

Use **`payment_source.apple_pay.experience_context`**, not `application_context`:

```json
{
  "intent": "CAPTURE",
  "purchase_units": [
    { "amount": { "currency_code": "USD", "value": "15.00" } }
  ],
  "payment_source": {
    "apple_pay": {
      "experience_context": {
        "return_url": "https://yoursite.com/success",
        "cancel_url": "https://yoursite.com/cancel"
      }
    }
  }
}
```

Post this body from a Spring controller using the same **`PayPalOrdersClient`** pattern as `create-order.md`.

## Best practices

- Hide Apple Pay when ineligible; always show PayPal and Card Fields as fallbacks.
- Verify domain association before go-live.
