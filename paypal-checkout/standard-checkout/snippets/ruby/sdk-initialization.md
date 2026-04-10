# SDK Initialization (Client-Side) — ERB + Sinatra

Standard Checkout supports **JS SDK v6** (web components + `createInstance`) and **v5** (`paypal.Buttons`). Pick one per page; **v6 is recommended** for new integrations.

Server serves an **ERB** template that loads the script and runs client-side initialization.

---

## Sinatra — route and template

```ruby
# frozen_string_literal: true

require "sinatra"

get "/checkout" do
  @paypal_client_id = ENV.fetch("PAYPAL_CLIENT_ID")
  @paypal_env = ENV.fetch("PAYPAL_ENVIRONMENT", "sandbox")
  erb :checkout
end
```

Place **`views/checkout.erb`** next to your app (or set `:views`).

---

## v6 — ERB template (sandbox vs live script URL)

```erb
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>Checkout</title>
  </head>
  <body>
    <div id="loading">Loading payments…</div>
    <paypal-button id="paypal-button" type="pay" hidden></paypal-button>

    <% if @paypal_env == "production" %>
      <script
        async
        src="https://www.paypal.com/web-sdk/v6/core"
        onload="onPayPalWebSdkLoaded()"></script>
    <% else %>
      <script
        async
        src="https://www.sandbox.paypal.com/web-sdk/v6/core"
        onload="onPayPalWebSdkLoaded()"></script>
    <% end %>

    <script>
      async function getBrowserSafeClientToken() {
        const response = await fetch('/paypal-api/auth/browser-safe-client-token');
        const contentType = response.headers.get('content-type') || '';
        if (!contentType.includes('application/json')) {
          throw new Error('Expected JSON from client token endpoint');
        }
        if (!response.ok) {
          const err = await response.json().catch(() => ({}));
          throw new Error(err.message || 'Token HTTP ' + response.status);
        }
        const data = await response.json();
        const token = data.accessToken || data.client_token;
        if (!token) throw new Error('Missing client token');
        return token;
      }

      async function onPayPalWebSdkLoaded() {
        try {
          const clientToken = await getBrowserSafeClientToken();
          const sdkInstance = await window.paypal.createInstance({
            clientToken,
            components: ['paypal-payments'],
            pageType: 'checkout',
          });

          const eligible = await sdkInstance.findEligibleMethods({
            currencyCode: 'USD',
            countryCode: 'US',
          });

          if (eligible.isEligible('paypal')) {
            document.getElementById('paypal-button').hidden = false;
          }
          document.getElementById('loading').hidden = true;
        } catch (e) {
          console.error(e);
          document.getElementById('loading').textContent = 'Payments unavailable.';
        }
      }
    </script>
  </body>
</html>
```

Wire `createOrder` / `onApprove` (or v6 session APIs) to your server routes from **`create-order.md`** and **`capture-order.md`**.

---

## v5 — ERB pattern (client id in query string)

Only the **public** `client_id` appears in the script URL.

```erb
<script src="https://www.paypal.com/sdk/js?client-id=<%= @paypal_client_id %>&currency=USD"></script>
<div id="paypal-button-container"></div>

<script>
  paypal
    .Buttons({
      createOrder: async () => {
        const res = await fetch('/paypal-api/checkout/orders/create', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ amount: '10.00', currency_code: 'USD' }),
        });
        if (!res.ok) throw new Error('create order failed');
        const data = await res.json();
        return data.id;
      },
      onApprove: async (data) => {
        await fetch('/paypal-api/checkout/orders/' + encodeURIComponent(data.orderID) + '/capture', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({}),
        });
      },
      onError: (err) => console.error(err),
    })
    .render('#paypal-button-container');
</script>
```

Use `www.sandbox.paypal.com` in the script `src` when `PAYPAL_ENVIRONMENT` is sandbox.

---

## Rails equivalent

- Add `app/views/checkouts/show.html.erb` with the same markup.
- Pass `@paypal_client_id` and `@paypal_env` from `CheckoutsController#show`.
- Use `javascript_include_tag` only if you wrap the PayPal URLs in asset policy (often inline script is simpler for SDK URLs).

---

## Best practices

- Initialize after SDK `onload` (or dynamic import) to avoid races.
- Hide buttons until eligibility succeeds when using v6.
- Keep **order amounts authoritative on the server** (`create-order.md`).
