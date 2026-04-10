# Google Pay integration (JS SDK v6 + Flask)

Google Pay is exposed via the **`googlepay-payments`** component. Use the **browser-safe client token** from **`GET /paypal-api/auth/browser-safe-client-token`**, then create and capture orders on the **Flask** side.

## Requirements

- **HTTPS** in production
- Browsers with **Google Pay JS** support (Chrome and others per Google)
- A **Google Pay merchant ID** from the Google Pay Business Console for production (sandbox rules per PayPal/Google docs)

## v6 initialization pattern

```javascript
async function initGooglePay() {
  const clientToken = await fetch("/paypal-api/auth/browser-safe-client-token")
    .then((r) => r.json())
    .then((d) => d.client_token);

  const sdkInstance = await window.paypal.createInstance({
    clientToken,
    components: ["googlepay-payments", "paypal-payments", "card-fields"],
    pageType: "checkout",
  });

  const eligibleMethods = await sdkInstance.findEligibleMethods?.();
  if (!eligibleMethods?.isEligible?.("googlepay")) {
    document.getElementById("google-pay-container").style.display = "none";
    return;
  }

  // Create Google Pay button / payment data session via googlepay-payments per current SDK
}
```

## Order payload (server)

Use **`payment_source.google_pay`** with **`experience_context`**:

```json
{
  "intent": "CAPTURE",
  "purchase_units": [
    { "amount": { "currency_code": "USD", "value": "25.00" } }
  ],
  "payment_source": {
    "google_pay": {
      "experience_context": {
        "return_url": "https://yoursite.com/paypal/return",
        "cancel_url": "https://yoursite.com/paypal/cancel"
      }
    }
  }
}

```

Branch in **`POST /paypal-api/checkout/orders/create`** when the client indicates Google Pay (for example `funding_source: "google_pay"`).

## Best practices

- Offer **fallback** payment methods when eligibility fails.
- Align **currency** and **country** with Google Pay and PayPal requirements.
- Test with **Google Pay test** environments in sandbox per PayPal documentation.
