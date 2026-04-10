# Google Pay — Client JS + server notes (PayPal Expanded Checkout)

Google Pay is exposed via the PayPal JS SDK (**`googlepay-payments`** in v6). Server-side, use **`java.net.http.HttpClient`** and Orders API v2 with **`payment_source.google_pay.experience_context`**.

**REST bases:** Sandbox `https://api-m.sandbox.paypal.com`, Production `https://api-m.paypal.com`.

## Requirements

- HTTPS.
- Google Pay merchant setup per [Google Pay Business Console](https://pay.google.com/business/console/) where required.
- [Google Pay with PayPal](https://developer.paypal.com/docs/checkout/apm/google-pay/)

## JS SDK v6 — initialize with Google Pay

```html
<script src="https://www.sandbox.paypal.com/web-sdk/v6/core"></script>
```

```javascript
async function initGooglePay(clientId, clientToken) {
  const sdkInstance = await window.paypal.createInstance({
    clientId,
    clientToken,
    components: ['googlepay-payments', 'paypal-payments', 'card-fields'],
    pageType: 'checkout'
  });

  const eligible = await sdkInstance.findEligibleMethods({ currencyCode: 'USD' });
  if (!eligible.isEligible('googlepay')) {
    document.getElementById('google-pay-container').style.display = 'none';
    return;
  }

  const googlePay = await sdkInstance.createGooglePay();
  await googlePay.render('#google-pay-container', {
    createOrder: async () => {
      const res = await fetch('/api/paypal/orders/google-pay', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currencyCode: 'USD', value: '18.00' })
      });
      return (await res.json()).id;
    },
    onApprove: async (data) => {
      await fetch(`/api/paypal/orders/${data.orderID}/capture`, { method: 'POST' });
    }
  });
}
```

Confirm `createGooglePay` / `render` signatures against the latest v6 reference.

## Server — create order with `payment_source.google_pay`

```json
{
  "intent": "CAPTURE",
  "purchase_units": [
    { "amount": { "currency_code": "USD", "value": "18.00" } }
  ],
  "payment_source": {
    "google_pay": {
      "experience_context": {
        "return_url": "https://yoursite.com/success",
        "cancel_url": "https://yoursite.com/cancel"
      }
    }
  }
}
```

## Card vs wallet reminder

- **Card Fields** → `payment_source.card` (see `create-order.md`).
- **Google Pay** → `payment_source.google_pay` with `experience_context`.
- Never use deprecated top-level **`application_context`** for these flows.
