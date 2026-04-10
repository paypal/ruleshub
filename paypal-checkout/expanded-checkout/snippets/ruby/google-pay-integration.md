# Google Pay Integration — Client JS (Ruby serves pages)

Use the PayPal JS SDK **Google Pay** component with **`googlepay-payments`**. Your **Ruby** app serves HTML/ERB and implements **create order** / **capture** against **Orders API v2**.

REST base URLs:

| Environment | Base URL |
|-------------|----------|
| Sandbox | `https://api-m.sandbox.paypal.com` |
| Production | `https://api-m.paypal.com` |

Use **`payment_source.paypal.experience_context`** on create order — **not** deprecated **`application_context`**.

---

## v6 — `createInstance` with Google Pay

```javascript
// public/checkout-googlepay.js
async function initGooglePay() {
  const tokenRes = await fetch('/paypal-api/auth/browser-safe-client-token');
  const { accessToken: clientToken } = await tokenRes.json();

  const sdk = await window.paypal.createInstance({
    clientId: window.__PAYPAL_CLIENT_ID__,
    clientToken,
    components: ['paypal-payments', 'googlepay-payments'],
    pageType: 'checkout',
  });

  const eligible = await sdk.findEligibleMethods({ currencyCode: 'USD' });
  if (!eligible?.isGooglePayEligible) {
    return null;
  }

  // Follow v6 Google Pay docs: paymentDataCallbacks, createOrder, onApprove
  return sdk;
}
```

See [Google Pay with JS SDK v6](https://docs.paypal.ai/payments/methods/digital-wallets/google-pay) for `googlePayConfig`, environment (`TEST`/`PRODUCTION`), and button rendering.

---

## v5 — script tag

```html
<script
  src="https://www.paypal.com/sdk/js?client-id=YOUR_CLIENT_ID&components=buttons,googlepay-buttons&currency=USD"
></script>
```

Sandbox script host: `https://www.sandbox.paypal.com`

---

## Ruby: create order (PayPal wallet path)

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

**POST** `#{paypal_api_base}/v2/checkout/orders` with bearer token — same pattern as **`create-order.md`**.

---

## Sinatra — static script + checkout page

```ruby
get "/checkout" do
  erb :checkout_googlepay
end
```

---

## Rails notes

- Register Google Pay in PayPal Business / developer settings as required.
- Align `currency_code` and `country` with `findEligibleMethods` and Google Pay API version.

## Best practices

- Fallback to PayPal button or card if Google Pay is not eligible.
- Log **PayPal-Debug-Id** on order failures.

## Common issues

| Issue | Fix |
|-------|-----|
| TEST vs PRODUCTION | Match Google Pay environment to `PAYPAL_ENVIRONMENT` |
| Pop-up blocked | Ensure user gesture for payment sheet |
