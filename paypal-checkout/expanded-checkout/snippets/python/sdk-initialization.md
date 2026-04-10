# SDK initialization — Expanded Checkout (Jinja2 + HTML/JS)

Expanded Checkout loads **Card Fields** alongside PayPal buttons. **v6** uses a **browser-safe client token**; **v5** loads the SDK with **`client-id`** and **`components=card-fields`**. Serve pages from Flask with **Jinja2** templates.

## Flask route

```python
import os
from flask import Flask, render_template

app = Flask(__name__)

@app.get("/checkout")
def checkout():
    env = os.environ.get("PAYPAL_ENVIRONMENT", "sandbox")
    return render_template(
        "expanded_checkout.html",
        paypal_env=env,
        paypal_client_id=os.environ["PAYPAL_CLIENT_ID"],
    )
```

## v6 — core + card-fields (recommended)

Script hosts:

| Environment | Script URL |
|-------------|------------|
| Sandbox | `https://www.sandbox.paypal.com/web-sdk/v6/core` |
| Production | `https://www.paypal.com/web-sdk/v6/core` |

**templates/expanded_checkout.html** (pattern):

```html
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Expanded Checkout</title>
</head>
<body>
  <div id="paypal-wallet"></div>
  <div id="card-number-container"></div>
  <div id="card-expiry-container"></div>
  <div id="card-cvv-container"></div>
  <button type="button" id="card-pay" disabled>Pay with card</button>

  <script>
    async function getClientToken() {
      const r = await fetch("/paypal-api/auth/browser-safe-client-token");
      if (!r.ok) throw new Error("client token failed");
      const data = await r.json();
      return data.client_token;
    }

    async function onPayPalWebSdkLoaded() {
      const clientToken = await getClientToken();
      const sdkInstance = await window.paypal.createInstance({
        clientToken,
        components: ["paypal-payments", "card-fields"],
        pageType: "checkout",
      });
      // Wallet buttons: use paypal-payments component per PayPal v6 docs
      // Card Fields: create card fields session, render fields, wire submit — see card-fields-integration.md
    }
  </script>

  {% if paypal_env == "production" %}
  <script
    src="https://www.paypal.com/web-sdk/v6/core"
    async
    onload="onPayPalWebSdkLoaded()"></script>
  {% else %}
  <script
    src="https://www.sandbox.paypal.com/web-sdk/v6/core"
    async
    onload="onPayPalWebSdkLoaded()"></script>
  {% endif %}
</body>
</html>
```

## v5 — Card Fields + Buttons

Load **hosted** SDK with **`card-fields`** (and **`buttons`**) in `components`:

```html
<script
  src="https://www.paypal.com/sdk/js?client-id={{ paypal_client_id }}&components=buttons,card-fields&currency=USD"
  data-sdk-integration-source="integrationbuilder"></script>
```

For sandbox script host, follow PayPal’s documented **sandbox** JS URL if you are not using `client-id`-only loading from `www.paypal.com`.

Typical v5 shape:

```javascript
paypal.Buttons({
  createOrder: function () {
    return fetch("/paypal-api/checkout/orders/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        amount: "10.00",
        currency_code: "USD",
        funding_source: "paypal",
      }),
    })
      .then((r) => r.json())
      .then((d) => d.id);
  },
  onApprove: function (data) {
    return fetch(`/paypal-api/checkout/orders/${data.orderID}/capture`, {
      method: "POST",
    }).then((r) => r.json());
  },
}).render("#paypal-wallet");

// Card Fields: paypal.CardFields({ createOrder, onApprove, style }) — see card-fields-integration.md
```

## Best practices

- Never embed **`PAYPAL_CLIENT_SECRET`** in templates or static JS.
- Keep **script host** (sandbox vs live) aligned with **`PAYPAL_ENVIRONMENT`** on the server.
- Add wallets or Fastlane by including additional **components** (`googlepay-payments`, `applepay-payments`, `fastlane`) per dedicated snippets.

## Common issues

- **v6 without client token**: `createInstance` requires the server-issued token from `/paypal-api/auth/browser-safe-client-token`.
- **CORS**: Serve API routes from the **same origin** as the checkout page, or configure CORS for your API paths.
