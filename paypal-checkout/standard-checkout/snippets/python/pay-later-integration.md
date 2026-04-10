# Pay Later (client-side, served from Flask)

**Pay Later** (Pay in 4 / Pay Monthly where available) is configured on the **client** via the PayPal JS SDK. Your Flask app serves HTML/JS and must use supported **currency** and **buyer country** rules per PayPal docs.

## v6: `createPayLaterOneTimePaymentSession`

After `createInstance`, use the Pay Later component/session API per current v6 documentation (names may align with `createPayLaterOneTimePaymentSession`).

**Pattern:**

```javascript
async function initPayLater(sdkInstance) {
  const session = await sdkInstance.createPayLaterOneTimePaymentSession({
    currencyCode: "USD",
  });
  return session;
}
```

**Eligibility:** Call `findEligibleMethods` before showing Pay Later UI:

```javascript
const eligible = await sdkInstance.findEligibleMethods({
  currencyCode: "USD",
  countryCode: "US",
});
if (eligible.isEligible("paylater")) {
  await initPayLater(sdkInstance);
}
```

Exact method names depend on the SDK minor version — verify against [PayPal v6 Pay Later docs](https://docs.paypal.ai/) for your release.

## v5 pattern

Load the SDK with Pay Later funding enabled:

```html
<script
  src="https://www.paypal.com/sdk/js?client-id=CLIENT_ID&currency=USD&enable-funding=paylater"
></script>
```

**JavaScript:**

```javascript
paypal
  .Buttons({
    fundingSource: paypal.FUNDING.PAYLATER,
    createOrder: function () {
      return fetch("/paypal-api/checkout/orders/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: "50.00", currency_code: "USD" }),
      })
        .then((res) => res.json())
        .then((data) => data.id);
    },
    onApprove: function (data) {
      return fetch(`/paypal-api/checkout/orders/${data.orderID}/capture`, {
        method: "POST",
      }).then((r) => r.json());
    },
  })
  .render("#paylater-button-container");
```

Use sandbox script URL when `PAYPAL_ENVIRONMENT` is sandbox.

## Flask: pass environment into template

```python
import os
from flask import Flask, render_template

app = Flask(__name__)

@app.get("/checkout")
def checkout():
    return render_template(
        "checkout_paylater.html",
        paypal_env=os.environ.get("PAYPAL_ENVIRONMENT", "sandbox"),
        paypal_client_id=os.environ["PAYPAL_CLIENT_ID"],
    )
```

Template: switch `www.sandbox.paypal.com` vs `www.paypal.com` for the SDK script `src`, matching your server-side API environment.

## Eligibility checking

- **Currency / region**: Pay Later availability varies by country and product; do not promise Pay Later until eligibility returns positive.
- **Amount limits**: Enforce min/max per PayPal rules for the buyer’s region.
- **Server-side order**: v6 requires **server-side order creation**; Pay Later still uses the same order/capture endpoints.

## Best practices

- Show a **fallback** (standard PayPal button) when Pay Later is ineligible.
- Keep **copy** compliant with PayPal marketing guidelines for Pay Later.
- Test in **sandbox** with Pay Later test buyer profiles.

## Common issues

- **Button not showing**: Wrong `enable-funding` (v5) or component not registered (v6).
- **Ineligible buyer**: Expected in sandbox; verify country/currency and test accounts.
- **Order creation failure**: Same validation issues as standard checkout (`create-order.md`).
