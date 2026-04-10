# Pay Later Buttons (Client-Side) — US

Pay Later button availability depends on **buyer eligibility**, **currency (USD)**, and **order amount**. Always check eligibility before showing Pay Later UI.

Source: https://docs.paypal.ai/developer/how-to/sdk/js/v6/configuration

## JS SDK v6 — Full Pay Later Button Integration

Source: https://docs.paypal.ai/developer/how-to/sdk/js/v6/configuration#recommended-frontend-setup

### HTML

```html
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>Pay Later Checkout</title>
</head>
<body>
  <paypal-button id="paypal-button" hidden></paypal-button>
  <paypal-pay-later-button id="paylater-button" hidden></paypal-pay-later-button>
  <paypal-credit-button id="credit-button" hidden></paypal-credit-button>

  <script src="app.js"></script>
  <script src="https://www.paypal.com/web-sdk/v6/core"
    async
    onload="onPayPalWebSdkLoaded()"></script>
</body>
</html>
```

Sandbox: use `https://www.sandbox.paypal.com/web-sdk/v6/core`

### app.js

```javascript
async function onPayPalWebSdkLoaded() {
  try {
    const sdkInstance = await window.paypal.createInstance({
      clientId: "YOUR_CLIENT_ID",
      components: ["paypal-payments"],
      pageType: "checkout",
    });

    const paymentMethods = await sdkInstance.findEligibleMethods({
      currencyCode: "USD",
    });

    if (paymentMethods.isEligible("paypal")) {
      setUpPayPalButton(sdkInstance);
    }

    if (paymentMethods.isEligible("paylater")) {
      const payLaterPaymentMethodDetails = paymentMethods.getDetails("paylater");
      setUpPayLaterButton(sdkInstance, payLaterPaymentMethodDetails);
    }

    if (paymentMethods.isEligible("credit")) {
      const paypalCreditPaymentMethodDetails = paymentMethods.getDetails("credit");
      setUpPayPalCreditButton(sdkInstance, paypalCreditPaymentMethodDetails);
    }
  } catch (error) {
    console.error("SDK initialization error:", error);
  }
}

const paymentSessionOptions = {
  async onApprove(data) {
    try {
      const orderData = await captureOrder({ orderId: data.orderId });
      console.log("Payment captured successfully:", orderData);
    } catch (error) {
      console.error("Payment capture failed:", error);
    }
  },
  onCancel(data) {
    console.log("Payment cancelled:", data);
  },
  onError(error) {
    console.error("Payment error:", error);
  },
};

async function setUpPayPalButton(sdkInstance) {
  const paypalPaymentSession = sdkInstance.createPayPalOneTimePaymentSession(
    paymentSessionOptions,
  );

  const paypalButton = document.querySelector("paypal-button");
  paypalButton.removeAttribute("hidden");

  paypalButton.addEventListener("click", async () => {
    try {
      await paypalPaymentSession.start(
        { presentationMode: "auto" },
        createOrder(),
      );
    } catch (error) {
      console.error("PayPal payment start error:", error);
    }
  });
}

async function setUpPayLaterButton(sdkInstance, payLaterPaymentMethodDetails) {
  const payLaterPaymentSession = sdkInstance.createPayLaterOneTimePaymentSession(
    paymentSessionOptions,
  );

  const { productCode, countryCode } = payLaterPaymentMethodDetails;
  const payLaterButton = document.querySelector("paypal-pay-later-button");

  payLaterButton.productCode = productCode;
  payLaterButton.countryCode = countryCode;
  payLaterButton.removeAttribute("hidden");

  payLaterButton.addEventListener("click", async () => {
    try {
      await payLaterPaymentSession.start(
        { presentationMode: "auto" },
        createOrder(),
      );
    } catch (error) {
      console.error("Pay Later payment start error:", error);
    }
  });
}

async function setUpPayPalCreditButton(sdkInstance, paypalCreditPaymentMethodDetails) {
  const paypalCreditPaymentSession = sdkInstance.createPayPalCreditOneTimePaymentSession(
    paymentSessionOptions,
  );

  const { countryCode } = paypalCreditPaymentMethodDetails;
  const paypalCreditButton = document.querySelector("paypal-credit-button");

  paypalCreditButton.countryCode = countryCode;
  paypalCreditButton.removeAttribute("hidden");

  paypalCreditButton.addEventListener("click", async () => {
    try {
      await paypalCreditPaymentSession.start(
        { presentationMode: "auto" },
        createOrder(),
      );
    } catch (error) {
      console.error("PayPal Credit payment start error:", error);
    }
  });
}

function createOrder() {
  return fetch("/paypal-api/checkout/orders/create", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ amount: "100.00", currency_code: "USD" }),
  })
    .then((response) => response.json())
    .then((data) => ({ orderId: data.id }));
}

async function captureOrder({ orderId }) {
  const response = await fetch(`/paypal-api/checkout/orders/${orderId}/capture`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
  });
  return response.json();
}
```

**Key v6 points:**
- `createOrder()` MUST return `{ orderId: "ORDER_ID" }` (object, not string)
- Must set `productCode` and `countryCode` on `<paypal-pay-later-button>` from `getDetails()`
- Always check `isEligible('paylater')` before showing the button

---

## JS SDK v5 — Pay Later Button

Source: https://developer.paypal.com/sdk/js/configuration/ (`enable-funding` parameter)

### Script tag

```html
<script src="https://www.paypal.com/sdk/js?client-id=YOUR_CLIENT_ID&enable-funding=paylater&currency=USD"></script>
```

### Standalone Pay Later button

```javascript
paypal.Buttons({
  fundingSource: paypal.FUNDING.PAYLATER,
  createOrder: function(data, actions) {
    return actions.order.create({
      purchase_units: [{
        amount: {
          value: "100.00"
        }
      }]
    });
  },
  onApprove: function(data, actions) {
    return actions.order.capture().then(function(details) {
      console.log("Transaction completed by " + details.payer.name.given_name);
    });
  },
  onError: function(err) {
    console.error(err);
  }
}).render("#paylater-button-container");
```

### Server-side order flow (v5)

```javascript
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
    }).then(function(res) { return res.json(); });
  },
}).render("#paylater-button-container");
```

**Key v5 points:**
- `enable-funding=paylater` in script tag enables the Pay Later button
- `createOrder` returns the order ID as a **string** (not an object)
- `data.orderID` (capital ID) in onApprove — different from v6's `data.orderId`
- `paypal.FUNDING.PAYLATER` for standalone button rendering

---

## Common issues

| Issue | Resolution |
|-------|------------|
| Pay Later button not showing (v5) | Add `enable-funding=paylater` to script tag |
| Pay Later button not showing (v6) | Check `isEligible('paylater')` — buyer or amount may not qualify |
| Wrong amount range | Pay in 4: $30–$1,500; Pay Monthly: $49–$10,000 |
| v6 createOrder fails | Must return `{ orderId }` object, not a string |
| Button attributes missing (v6) | Must set `productCode` and `countryCode` from `getDetails()` |
