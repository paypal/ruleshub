# Pay Later Client-Side (served from Spring Boot) — US

Pay Later buttons and messaging configured on the client via the PayPal JS SDK. Spring Boot serves Thymeleaf templates.

## Spring Boot controller

```java
@Controller
public class CheckoutController {

    @Value("${paypal.client-id}")
    private String clientId;

    @Value("${paypal.environment:sandbox}")
    private String environment;

    @GetMapping("/checkout")
    public String checkout(Model model) {
        model.addAttribute("paypalClientId", clientId);
        model.addAttribute("paypalEnv", environment);
        return "checkout_paylater";
    }

    @GetMapping("/product/{id}")
    public String product(@PathVariable String id, Model model) {
        Product product = productService.findById(id);
        model.addAttribute("product", product);
        model.addAttribute("paypalClientId", clientId);
        model.addAttribute("paypalEnv", environment);
        return "product_paylater";
    }
}
```

---

## v6 — Pay Later buttons (templates/checkout_paylater.html)

Source: https://docs.paypal.ai/developer/how-to/sdk/js/v6/configuration

```html
<!doctype html>
<html lang="en" xmlns:th="http://www.thymeleaf.org">
<head>
  <meta charset="utf-8" />
  <title>Checkout</title>
</head>
<body>
  <paypal-button id="paypal-button" hidden></paypal-button>
  <paypal-pay-later-button id="paylater-button" hidden></paypal-pay-later-button>

  <script th:inline="javascript">
    const PAYPAL_CLIENT_ID = [[${paypalClientId}]];

    async function onPayPalWebSdkLoaded() {
      const sdkInstance = await window.paypal.createInstance({
        clientId: PAYPAL_CLIENT_ID,
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

  <script th:if="${paypalEnv == 'production'}" src="https://www.paypal.com/web-sdk/v6/core" async onload="onPayPalWebSdkLoaded()"></script>
  <script th:unless="${paypalEnv == 'production'}" src="https://www.sandbox.paypal.com/web-sdk/v6/core" async onload="onPayPalWebSdkLoaded()"></script>
</body>
</html>
```

---

## v6 — Pay Later messaging (templates/product_paylater.html)

Source: https://docs.paypal.ai/payments/methods/pay-later/get-started

```html
<!doctype html>
<html lang="en" xmlns:th="http://www.thymeleaf.org">
<head>
  <meta charset="utf-8" />
  <title th:text="${product.name}">Product</title>
  <script src="https://www.paypal.com/web-sdk/v6/core"></script>
  <script src="https://www.paypal.com/web-sdk/v6/paypal-messages"></script>
</head>
<body>
  <h1 th:text="${product.name}">Product Name</h1>
  <p>$<span th:text="${product.price}">0.00</span></p>

  <paypal-message
    th:attr="amount=${product.price}"
    currency-code="USD"
    logo-type="WORDMARK"
    text-color="BLACK"
  ></paypal-message>

  <script th:inline="javascript">
    (async () => {
      const sdkInstance = await window.paypal.createInstance({
        clientId: [[${paypalClientId}]],
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

```html
<script th:src="'https://www.paypal.com/sdk/js?client-id=' + ${paypalClientId} + '&enable-funding=paylater&components=buttons,messages&currency=USD'"></script>

<div id="paylater-button-container"></div>

<div data-pp-message
  th:attr="data-pp-amount=${product.price}"
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
