# Google Pay — Razor + client JS (Expanded Checkout, JS SDK v6)

Add the **`googlepay-payments`** component to **`createInstance`**. The browser shows the **Google Pay** button; your backend uses **`HttpClient`** against **`https://api-m.sandbox.paypal.com`** or **`https://api-m.paypal.com`** for OAuth, **create order**, and **capture**.

## SDK script (sandbox)

```html
<script src="https://www.sandbox.paypal.com/web-sdk/v6/core"></script>
```

Production: `https://www.paypal.com/web-sdk/v6/core`

## `Pages/CheckoutGooglePay.cshtml` (excerpt)

```cshtml
@page
@model CheckoutGooglePayModel

<div id="googlepay-container"></div>

@section Scripts {
<script type="module">
  async function auth() {
    const res = await fetch('/paypal-api/auth/browser-safe-client-token', { credentials: 'same-origin' });
    return { accessToken: (await res.json()).accessToken };
  }

  const sdkInstance = await window.paypal.createInstance({
    clientId: '@Model.PayPalClientId',
    components: ['paypal-payments', 'googlepay-payments'],
    pageType: 'checkout',
    auth
  });

  const googlePay = sdkInstance.Googlepay ?? sdkInstance.googlepay;
  await googlePay.render({
    containerId: 'googlepay-container',
    createOrder: async () => {
      const r = await fetch('/paypal-api/checkout/orders/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({
          currencyCode: 'USD',
          value: '10.00',
          includePayPalExperience: true
        })
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j?.detail || 'create failed');
      return j.id;
    },
    onApprove: async ({ orderID }) => {
      const cap = await fetch(
        '/paypal-api/checkout/orders/' + encodeURIComponent(orderID) + '/capture',
        { method: 'POST', credentials: 'same-origin' });
      if (!cap.ok) throw new Error('capture failed');
    }
  });
</script>
}
```

## Server

- **GET** `/paypal-api/auth/browser-safe-client-token` — **client-token-generation.md**
- **POST** `/paypal-api/checkout/orders/create` — include **`payment_source.paypal.experience_context`** when using wallet UX (**create-order.md**)
- **POST** `/paypal-api/checkout/orders/{id}/capture` — **capture-order.md**

## REST base URLs

- Sandbox: `https://api-m.sandbox.paypal.com`
- Production: `https://api-m.paypal.com`

## References

- [Google Pay with JS SDK v6](https://docs.paypal.ai/payments/methods/digital-wallets/google-pay)
- [Google Pay (developer.paypal.com)](https://developer.paypal.com/docs/checkout/apm/google-pay/)
