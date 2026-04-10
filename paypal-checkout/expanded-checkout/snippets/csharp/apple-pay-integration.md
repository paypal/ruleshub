# Apple Pay — Razor + client JS (Expanded Checkout, JS SDK v6)

Use the **`applepay-payments`** component with **`window.paypal.createInstance`**. The browser handles **Apple Pay** sheets; your **ASP.NET Core** app provides the **browser-safe client token** and **create/capture** order endpoints using **`HttpClient`**.

## SDK script (sandbox)

```html
<script src="https://www.sandbox.paypal.com/web-sdk/v6/core"></script>
```

Production: `https://www.paypal.com/web-sdk/v6/core`

## `Pages/CheckoutApplePay.cshtml` (excerpt)

```cshtml
@page
@model CheckoutApplePayModel

<div id="applepay-container"></div>

@section Scripts {
<script type="module">
  async function getAuth() {
    const res = await fetch('/paypal-api/auth/browser-safe-client-token', { credentials: 'same-origin' });
    const { accessToken } = await res.json();
    return { accessToken };
  }

  const sdkInstance = await window.paypal.createInstance({
    clientId: '@Model.PayPalClientId',
    components: ['paypal-payments', 'applepay-payments'],
    pageType: 'checkout',
    auth: getAuth
  });

  if (window.ApplePaySession && ApplePaySession.canMakePayments()) {
    const applePay = sdkInstance.Applepay ?? sdkInstance.applepay;
    await applePay.render({
      containerId: 'applepay-container',
      // countryCode, currencyCode, requiredBillingContactFields, etc. — see current SDK reference
      createOrder: async () => {
        const r = await fetch('/paypal-api/checkout/orders/create', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'same-origin',
          body: JSON.stringify({ currencyCode: 'USD', value: '10.00', includePayPalExperience: true })
        });
        const j = await r.json();
        if (!r.ok) throw new Error(j?.detail || 'create failed');
        return j.id;
      },
      onApprove: async ({ orderID }) => {
        await fetch('/paypal-api/checkout/orders/' + encodeURIComponent(orderID) + '/capture', {
          method: 'POST',
          credentials: 'same-origin'
        });
      }
    });
  }
</script>
}
```

## Server: PayPal wallet experience

When the order includes the **PayPal wallet** path, configure **`payment_source.paypal.experience_context`** (not **`application_context`**) — see **create-order.md**. For wallet-only Apple Pay flows, follow the latest Orders payload requirements in PayPal docs.

## Requirements

- **HTTPS**, supported domain, Apple Pay capability where applicable.
- Valid **merchant** and **PayPal** Apple Pay configuration in the Developer Dashboard.

## References

- [Apple Pay with JS SDK v6](https://docs.paypal.ai/payments/methods/digital-wallets/apple-pay)
- [Apple Pay (developer.paypal.com)](https://developer.paypal.com/docs/checkout/apm/apple-pay/)
