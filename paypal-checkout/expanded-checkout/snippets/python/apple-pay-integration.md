# Apple Pay integration (JS SDK v6 + Flask)

Apple Pay on the web uses the **`applepay-payments`** component with the same **browser-safe client token** as Expanded Checkout. Your Flask app still creates and captures **Orders** on the server.

## Requirements

- **Safari** (and compatible Apple environments) with **Apple Pay** available
- **HTTPS** — Apple Pay does not work on plain HTTP
- **Merchant registration** with PayPal for Apple Pay
- **Domain verification** — host Apple’s domain association file for your domain

## Domain verification

PayPal / Apple require the **Apple Pay domain association** file served at a well-known path (exact filename and path per Apple and PayPal checkout docs). Complete verification in the **PayPal Developer Dashboard** for your Apple Pay domains before production.

## v6 initialization pattern

```javascript
async function initApplePay() {
  const clientToken = await fetch("/paypal-api/auth/browser-safe-client-token")
    .then((r) => r.json())
    .then((d) => d.client_token);

  const sdkInstance = await window.paypal.createInstance({
    clientToken,
    components: ["applepay-payments", "paypal-payments"],
    pageType: "checkout",
  });

  const eligibleMethods = await sdkInstance.findEligibleMethods?.();
  if (!eligibleMethods?.isEligible?.("applepay")) {
    document.getElementById("apple-pay-container").style.display = "none";
    return;
  }

  // Build Apple Pay session / button via applepay-payments component per current SDK docs
}
```

## Order payload (server)

Use **`payment_source.apple_pay`** with **`experience_context`** for return/cancel (not legacy `application_context` on the order root):

```json
{
  "intent": "CAPTURE",
  "purchase_units": [
    { "amount": { "currency_code": "USD", "value": "25.00" } }
  ],
  "payment_source": {
    "apple_pay": {
      "experience_context": {
        "return_url": "https://yoursite.com/paypal/return",
        "cancel_url": "https://yoursite.com/paypal/cancel"
      }
    }
  }
}
```

Your **`POST /paypal-api/checkout/orders/create`** can branch on `funding_source: "apple_pay"` and attach this `payment_source`.

## Best practices

- Hide the Apple Pay button when **`isEligible('applepay')`** is false; always offer **PayPal** and **card** fallbacks.
- Test on **real Apple devices** with sandbox accounts.
- Keep **return_url** / **cancel_url** on your verified HTTPS domain.
