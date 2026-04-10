# Client-side SDK initialization (HTML/JS from Flask)

Standard Checkout loads the PayPal JavaScript SDK in the browser. **v6** uses a browser-safe client token from your server; **v5** often uses `client-id` in the script URL. Serve HTML via **Jinja2** templates from Flask.

## v6 script tag (sandbox vs production)

Use the correct script host for your environment:

| Environment | Example script URL |
|-------------|-------------------|
| Sandbox | `https://www.sandbox.paypal.com/web-sdk/v6/core` |
| Production | `https://www.paypal.com/web-sdk/v6/core` |

## Flask route and Jinja2 template

**app.py** (excerpt):

```python
from flask import Flask, render_template

app = Flask(__name__)

@app.get("/checkout")
def checkout_page():
    return render_template("checkout.html", paypal_env="sandbox")
```

**templates/checkout.html** (v6 — fetches client token from your API):

```html
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Checkout</title>
</head>
<body>
  <div id="paypal-buttons"></div>

  <script>
    async function getClientToken() {
      const r = await fetch("/paypal-api/auth/browser-safe-client-token");
      if (!r.ok) throw new Error("client token failed");
      const data = await r.json();
      return data.client_token;
    }

    async function onPayPalLoaded() {
      const clientToken = await getClientToken();
      const sdk = await window.paypal.createInstance({
        clientToken,
        components: ["paypal-payments"],
        pageType: "checkout",
      });
      // Render buttons per v6 docs (paypal-payments component)
      // await sdk.PayPalPayments({ ... }).render("#paypal-buttons");
    }
  </script>

  {% if paypal_env == "production" %}
  <script
    src="https://www.paypal.com/web-sdk/v6/core"
    async
    onload="onPayPalLoaded()"></script>
  {% else %}
  <script
    src="https://www.sandbox.paypal.com/web-sdk/v6/core"
    async
    onload="onPayPalLoaded()"></script>
  {% endif %}
</body>
</html>
```

Pass `paypal_env` from `os.environ.get("PAYPAL_ENVIRONMENT", "sandbox")` instead of hardcoding.

## v5 initialization pattern

Load v5 with your **client ID** (public) in the query string:

**Sandbox:**

```html
<script
  src="https://www.paypal.com/sdk/js?client-id=YOUR_CLIENT_ID&currency=USD"
  data-sdk-integration-source="integrationbuilder"></script>
```

Use `www.sandbox.paypal.com` for sandbox script URL if you follow PayPal’s hosted SDK URL pattern for sandbox.

Typical v5 flow:

```javascript
paypal.Buttons({
  createOrder: function () {
    return fetch("/paypal-api/checkout/orders/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ amount: "10.00", currency_code: "USD" }),
    }).then((res) => res.json()).then((data) => data.id);
  },
  onApprove: function (data) {
    return fetch(`/paypal-api/checkout/orders/${data.orderID}/capture`, {
      method: "POST",
    }).then((res) => res.json());
  },
}).render("#paypal-buttons");
```

## v6 initialization pattern (summary)

1. `GET /paypal-api/auth/browser-safe-client-token` → `client_token`
2. `await paypal.createInstance({ clientToken, components: [...], pageType: "checkout" })`
3. Create order **server-side** (`POST /paypal-api/checkout/orders/create`) from your button handler
4. Approve → **capture** on server (`POST .../capture`)

## Best practices

- **Never** put `PAYPAL_CLIENT_SECRET` in templates or static JS.
- Serve checkout pages over **HTTPS** in production.
- Keep one source of truth for **currency** and **environment** (template variables from Flask config).

## Common issues

- **CORS**: If the checkout page is on another origin, configure CORS for `/paypal-api/*` or proxy APIs through the same host as the page.
- **Mixed sandbox/production**: Script host and your server’s `PAYPAL_ENVIRONMENT` must match.
- **v6 without client token**: `createInstance` requires the server-issued token; the public client ID alone is not sufficient for the v6 core flow described in current docs.
