# Pay Later Client-Side (served from Flask) — US

Pay Later buttons and messaging configured on the client via the PayPal JS SDK. Flask serves the HTML/JS templates.

## Flask route — pass environment to template

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

@app.get("/product/<product_id>")
def product(product_id):
    product = get_product(product_id)
    return render_template(
        "product_paylater.html",
        paypal_env=os.environ.get("PAYPAL_ENVIRONMENT", "sandbox"),
        paypal_client_id=os.environ["PAYPAL_CLIENT_ID"],
        product=product,
    )
```

---

## v6 — Pay Later buttons (templates/checkout_paylater.html)

Source: https://docs.paypal.ai/developer/how-to/sdk/js/v6/configuration

```html
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>Checkout</title>
</head>
<body>
  <paypal-button id="paypal-button" hidden></paypal-button>
  <paypal-pay-later-button id="paylater-button" hidden></paypal-pay-later-button>

  <script>
    async function onPayPalWebSdkLoaded() {
      const sdkInstance = await window.paypal.createInstance({
        clientId: "{{ paypal_client_id }}",
        components: ["paypal-payments"],
        pageType: "checkout",
      });

      const paymentMethods = await sdkInstance.findEligibleMethods({
        currencyCode: "USD",
      });

      const paymentSessionOptions = {
        async onApprove(data) {
          const res = await fetch(`/paypal-api/checkout/orders/${data.orderId}/capture`, {
            method: "POST",
          });
          const orderData = await res.json();
          console.log("Captured:", orderData);
        },
        onCancel() { console.log("Cancelled"); },
        onError(error) { console.error("Error:", error); },
      };

      if (paymentMethods.isEligible("paypal")) {
        const session = sdkInstance.createPayPalOneTimePaymentSession(paymentSessionOptions);
        const btn = document.querySelector("paypal-button");
        btn.removeAttribute("hidden");
        btn.addEventListener("click", async () => {
          await session.start({ presentationMode: "auto" }, createOrder());
        });
      }

      if (paymentMethods.isEligible("paylater")) {
        const details = paymentMethods.getDetails("paylater");
        const session = sdkInstance.createPayLaterOneTimePaymentSession(paymentSessionOptions);
        const btn = document.querySelector("paypal-pay-later-button");
        btn.productCode = details.productCode;
        btn.countryCode = details.countryCode;
        btn.removeAttribute("hidden");
        btn.addEventListener("click", async () => {
          await session.start({ presentationMode: "auto" }, createOrder());
        });
      }
    }

    function createOrder() {
      return fetch("/paypal-api/checkout/orders/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: "100.00", currency_code: "USD" }),
      })
        .then((r) => r.json())
        .then((data) => ({ orderId: data.id }));
    }
  </script>

  {% if paypal_env == "production" %}
  <script src="https://www.paypal.com/web-sdk/v6/core" async onload="onPayPalWebSdkLoaded()"></script>
  {% else %}
  <script src="https://www.sandbox.paypal.com/web-sdk/v6/core" async onload="onPayPalWebSdkLoaded()"></script>
  {% endif %}
</body>
</html>
```

---

## v6 — Pay Later messaging (templates/product_paylater.html)

Source: https://docs.paypal.ai/payments/methods/pay-later/get-started

```html
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>{{ product.name }}</title>
  <script src="https://www.paypal.com/web-sdk/v6/core"></script>
  <script src="https://www.paypal.com/web-sdk/v6/paypal-messages"></script>
</head>
<body>
  <h1>{{ product.name }}</h1>
  <p>${{ product.price }}</p>

  <paypal-message
    amount="{{ product.price }}"
    currency-code="USD"
    logo-type="WORDMARK"
    text-color="BLACK"
  ></paypal-message>

  <script>
    (async () => {
      const sdkInstance = await window.paypal.createInstance({
        clientId: "{{ paypal_client_id }}",
      });
      const messagesInstance = sdkInstance.createPayPalMessages();
    })();
  </script>
</body>
</html>
```

---

## v5 — Pay Later buttons

Source: https://developer.paypal.com/sdk/js/configuration/

```html
<script src="https://www.paypal.com/sdk/js?client-id={{ paypal_client_id }}&enable-funding=paylater&currency=USD"></script>

<div id="paylater-button-container"></div>

<script>
  paypal.Buttons({
    fundingSource: paypal.FUNDING.PAYLATER,
    createOrder: function() {
      return fetch("/paypal-api/checkout/orders/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: "100.00", currency_code: "USD" }),
      })
        .then(function(res) { return res.json(); })
        .then(function(data) { return data.id; });
    },
    onApprove: function(data) {
      return fetch("/paypal-api/checkout/orders/" + data.orderID + "/capture", {
        method: "POST",
      }).then(function(r) { return r.json(); });
    },
  }).render("#paylater-button-container");
</script>
```

## v5 — Pay Later messaging

Source: https://developer.paypal.com/sdk/js/configuration/

```html
<script src="https://www.paypal.com/sdk/js?client-id={{ paypal_client_id }}&components=messages"></script>

<div data-pp-message
  data-pp-amount="{{ product.price }}"
  data-pp-style-layout="text"
  data-pp-style-logo-type="primary"
  data-pp-style-logo-position="left"
  data-pp-style-text-color="black">
</div>
```

## Best practices

- Never embed `PAYPAL_CLIENT_SECRET` in templates or static JS
- Switch script host (sandbox vs production) based on `PAYPAL_ENVIRONMENT` server-side
- Use Jinja2 template variables for `client_id` and product amounts
- Always check eligibility (v6) before showing Pay Later button
