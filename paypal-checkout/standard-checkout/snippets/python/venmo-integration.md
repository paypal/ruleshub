# Venmo (client-side JS)

**Venmo** is available to eligible US buyers paying in **USD**. Integrate on the **client** with the PayPal JS SDK; Flask serves templates and static JS only.

## Requirements

- **Buyer country**: US (Venmo is US-focused for consumer checkout).
- **Currency**: **USD** for typical one-time Venmo flows.
- **Environment**: Use sandbox script and API hosts for development; production for live.

## v6: `createVenmoOneTimePaymentSession`

Initialize the SDK with both PayPal and Venmo components, fetch a **browser-safe client token** from your server, then create a Venmo one-time session:

```javascript
async function onPayPalLoaded() {
  const tokenRes = await fetch("/paypal-api/auth/browser-safe-client-token");
  const { client_token } = await tokenRes.json();

  const sdk = await window.paypal.createInstance({
    clientToken: client_token,
    components: ["paypal-payments", "venmo-payments"],
    pageType: "checkout",
  });

  const eligible = await sdk.findEligibleMethods({
    currencyCode: "USD",
    countryCode: "US",
  });

  if (eligible.isEligible("venmo")) {
    const venmoSession = await sdk.createVenmoOneTimePaymentSession({
      // Amount, flow options — follow current v6 Venmo API reference
      currencyCode: "USD",
    });
    // Render Venmo button / handle approval → server create/capture order
    await venmoSession.render("#venmo-container");
  } else {
    document.getElementById("venmo-container").style.display = "none";
  }
}
```

Wire **order creation** and **capture** to your Flask routes (`POST /paypal-api/checkout/orders/create`, `POST .../capture`) the same way as PayPal card/button flows.

## v5 pattern

Include Venmo in funding sources and use `paypal.FUNDING.VENMO`:

```html
<script
  src="https://www.paypal.com/sdk/js?client-id=CLIENT_ID&currency=USD&enable-funding=venmo"
></script>
```

```javascript
paypal
  .Buttons({
    fundingSource: paypal.FUNDING.VENMO,
    createOrder: function () {
      return fetch("/paypal-api/checkout/orders/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: "25.00", currency_code: "USD" }),
      })
        .then((r) => r.json())
        .then((d) => d.id);
    },
    onApprove: function (data) {
      return fetch(`/paypal-api/checkout/orders/${data.orderID}/capture`, {
        method: "POST",
      }).then((r) => r.json());
    },
  })
  .render("#venmo-button-container");
```

Use **sandbox** SDK URL when testing (`www.sandbox.paypal.com` per PayPal SDK loader docs).

## Flask template note

```jinja2
{# Match PAYPAL_ENVIRONMENT with script host #}
{% if paypal_env == 'production' %}
<script src="https://www.paypal.com/sdk/js?client-id={{ paypal_client_id }}&currency=USD&enable-funding=venmo" async></script>
{% else %}
<script src="https://www.sandbox.paypal.com/sdk/js?client-id={{ paypal_client_id }}&currency=USD&enable-funding=venmo" async></script>
{% endif %}
```

Expose only **`PAYPAL_CLIENT_ID`** to templates, never the secret.

## Best practices

- Always provide a **PayPal** fallback when Venmo is not eligible.
- On mobile, Venmo may deep-link to the app; test on real devices.
- Log **eligibility** outcomes only at debug level; avoid PII.

## Common issues

- **Not eligible**: Non-US IP, wrong currency, or buyer account not Venmo-enabled.
- **USD only**: Using `EUR` or others will typically hide Venmo.
- **Sandbox**: Use PayPal test accounts documented for Venmo scenarios.
