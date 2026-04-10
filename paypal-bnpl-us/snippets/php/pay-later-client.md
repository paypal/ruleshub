# Pay Later Client-Side (served from PHP) — US

Pay Later buttons and messaging configured on the client via the PayPal JS SDK. PHP serves the HTML templates.

## PHP — pass environment to template

```php
<?php
$paypalClientId = getenv('PAYPAL_CLIENT_ID');
$paypalEnv = getenv('PAYPAL_ENVIRONMENT') ?: 'sandbox';
?>
```

---

## v6 — Pay Later buttons (checkout_paylater.php)

Source: https://docs.paypal.ai/developer/how-to/sdk/js/v6/configuration

```php
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
        clientId: "<?= htmlspecialchars($paypalClientId) ?>",
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
          console.log("Captured:", await res.json());
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

  <?php if ($paypalEnv === 'production'): ?>
  <script src="https://www.paypal.com/web-sdk/v6/core" async onload="onPayPalWebSdkLoaded()"></script>
  <?php else: ?>
  <script src="https://www.sandbox.paypal.com/web-sdk/v6/core" async onload="onPayPalWebSdkLoaded()"></script>
  <?php endif; ?>
</body>
</html>
```

---

## v6 — Pay Later messaging (product_paylater.php)

Source: https://docs.paypal.ai/payments/methods/pay-later/get-started

```php
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title><?= htmlspecialchars($product['name']) ?></title>
  <script src="https://www.paypal.com/web-sdk/v6/core"></script>
  <script src="https://www.paypal.com/web-sdk/v6/paypal-messages"></script>
</head>
<body>
  <h1><?= htmlspecialchars($product['name']) ?></h1>
  <p>$<?= htmlspecialchars($product['price']) ?></p>

  <paypal-message
    amount="<?= htmlspecialchars($product['price']) ?>"
    currency-code="USD"
    logo-type="WORDMARK"
    text-color="BLACK"
  ></paypal-message>

  <script>
    (async () => {
      const sdkInstance = await window.paypal.createInstance({
        clientId: "<?= htmlspecialchars($paypalClientId) ?>",
      });
      sdkInstance.createPayPalMessages();
    })();
  </script>
</body>
</html>
```

---

## v5 — Pay Later buttons + messaging

Source: https://developer.paypal.com/sdk/js/configuration/

```php
<script src="https://www.paypal.com/sdk/js?client-id=<?= htmlspecialchars($paypalClientId) ?>&enable-funding=paylater&components=buttons,messages&currency=USD"></script>

<div id="paylater-button-container"></div>

<div data-pp-message
  data-pp-amount="<?= htmlspecialchars($product['price']) ?>"
  data-pp-style-layout="text"
  data-pp-style-logo-type="primary"
  data-pp-style-text-color="black">
</div>

<script>
  paypal.Buttons({
    fundingSource: paypal.FUNDING.PAYLATER,
    createOrder: function() {
      return fetch("/paypal-api/checkout/orders/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: "100.00", currency_code: "USD" }),
      }).then(function(res) { return res.json(); })
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
