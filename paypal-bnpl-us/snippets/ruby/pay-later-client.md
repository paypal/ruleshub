# Pay Later Client-Side (served from Sinatra/ERB) — US

Pay Later buttons and messaging configured on the client via the PayPal JS SDK. Sinatra serves ERB templates.

## Sinatra route

```ruby
get "/checkout" do
  @paypal_client_id = ENV.fetch("PAYPAL_CLIENT_ID")
  @paypal_env = ENV.fetch("PAYPAL_ENVIRONMENT", "sandbox")
  erb :checkout_paylater
end

get "/product/:id" do
  @product = get_product(params[:id])
  @paypal_client_id = ENV.fetch("PAYPAL_CLIENT_ID")
  @paypal_env = ENV.fetch("PAYPAL_ENVIRONMENT", "sandbox")
  erb :product_paylater
end
```

---

## v6 — Pay Later buttons (views/checkout_paylater.erb)

Source: https://docs.paypal.ai/developer/how-to/sdk/js/v6/configuration

```erb
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
        clientId: "<%= @paypal_client_id %>",
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

  <% if @paypal_env == "production" %>
  <script src="https://www.paypal.com/web-sdk/v6/core" async onload="onPayPalWebSdkLoaded()"></script>
  <% else %>
  <script src="https://www.sandbox.paypal.com/web-sdk/v6/core" async onload="onPayPalWebSdkLoaded()"></script>
  <% end %>
</body>
</html>
```

---

## v6 — Pay Later messaging (views/product_paylater.erb)

Source: https://docs.paypal.ai/payments/methods/pay-later/get-started

```erb
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title><%= @product[:name] %></title>
  <script src="https://www.paypal.com/web-sdk/v6/core"></script>
  <script src="https://www.paypal.com/web-sdk/v6/paypal-messages"></script>
</head>
<body>
  <h1><%= @product[:name] %></h1>
  <p>$<%= @product[:price] %></p>

  <paypal-message
    amount="<%= @product[:price] %>"
    currency-code="USD"
    logo-type="WORDMARK"
    text-color="BLACK"
  ></paypal-message>

  <script>
    (async () => {
      const sdkInstance = await window.paypal.createInstance({
        clientId: "<%= @paypal_client_id %>",
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

```erb
<script src="https://www.paypal.com/sdk/js?client-id=<%= @paypal_client_id %>&enable-funding=paylater&components=buttons,messages&currency=USD"></script>

<div id="paylater-button-container"></div>

<div data-pp-message
  data-pp-amount="<%= @product[:price] %>"
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
