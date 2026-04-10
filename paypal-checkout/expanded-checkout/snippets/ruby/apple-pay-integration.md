# Apple Pay Integration — Client JS (Ruby serves pages)

Use the PayPal JS SDK **Apple Pay** component with **`applepay-payments`**. Your **Ruby** app serves ERB/HTML and proxies **orders** to PayPal REST (`api-m`).

REST base URLs:

| Environment | Base URL |
|-------------|----------|
| Sandbox | `https://api-m.sandbox.paypal.com` |
| Production | `https://api-m.paypal.com` |

Order bodies use **`payment_source`** (e.g. **`payment_source.paypal.experience_context`**) — **not** deprecated **`application_context`**.

---

## v6 — `createInstance` with Apple Pay

```javascript
// public/checkout-applepay.js
async function initApplePay() {
  const tokenRes = await fetch('/paypal-api/auth/browser-safe-client-token');
  const { accessToken: clientToken } = await tokenRes.json();

  const sdk = await window.paypal.createInstance({
    clientId: window.__PAYPAL_CLIENT_ID__,
    clientToken,
    components: ['paypal-payments', 'applepay-payments'],
    pageType: 'checkout',
  });

  const eligible = await sdk.findEligibleMethods({ currencyCode: 'USD' });
  if (!eligible?.isApplePayEligible) {
    return null;
  }

  // Mount Apple Pay per v6 docs (ApplePaySession, merchant validation via PayPal)
  // const applePay = await sdk.ApplePay({ ... createOrder, onApprove ... });
  return sdk;
}
```

Follow [Apple Pay with JS SDK v6](https://docs.paypal.ai/payments/methods/digital-wallets/apple-pay) for domain registration, `merchantSession`, and button rendering.

---

## v5 — script tag

```html
<script
  src="https://www.paypal.com/sdk/js?client-id=YOUR_CLIENT_ID&components=buttons,applepay-buttons&currency=USD"
></script>
```

Sandbox: `https://www.sandbox.paypal.com/sdk/js?...`

---

## Ruby: create order for Apple Pay (PayPal wallet)

Apple Pay through PayPal still uses Orders API v2. Example **`payment_source.paypal`**:

```ruby
order_payload = {
  intent: "CAPTURE",
  purchase_units: [
    {
      amount: {
        currency_code: currency,
        value: amount
      }
    }
  ],
  payment_source: {
    paypal: {
      experience_context: {
        payment_method_preference: "IMMEDIATE_PAYMENT_REQUIRED",
        shipping_preference: "NO_SHIPPING",
        user_action: "PAY_NOW",
        return_url: "#{base_url}/checkout/return",
        cancel_url: "#{base_url}/checkout/cancel"
      }
    }
  }
}
```

**POST** `{paypal_api_base}/v2/checkout/orders` with Authorization bearer (see **`create-order.md`**).

---

## ERB snippet

```erb
<% sdk = ENV['PAYPAL_ENVIRONMENT'].to_s.downcase == 'production' ? 'https://www.paypal.com' : 'https://www.sandbox.paypal.com' %>
<script src="<%= sdk %>/web-sdk/v6/core"></script>
<script src="/checkout-applepay.js" defer></script>
```

---

## Rails notes

- Host **Apple Pay domain verification** file at `/.well-known/apple-developer-merchantid-domain-association` per Apple + PayPal docs.
- Use HTTPS everywhere.

## Best practices

- Hide the Apple Pay button when `isApplePayEligible` is false.
- Capture server-side in `onApprove` with idempotency keys.

## Common issues

| Issue | Fix |
|-------|-----|
| Button not shown | Safari + HTTPS + registered domain |
| Merchant validation fails | Check PayPal dashboard Apple Pay setup |
