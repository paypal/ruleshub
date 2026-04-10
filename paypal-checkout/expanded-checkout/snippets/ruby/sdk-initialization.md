# SDK Initialization — Expanded Checkout (ERB + Card Fields)

Serve an **ERB** page that loads the PayPal JS SDK with **Card Fields**, provides DOM containers for hosted fields, and bootstraps **`findEligibleMethods`** so you only show PayPal and card when supported.

## Script URLs (JS SDK v6)

| Environment | Script `src` |
|-------------|--------------|
| Sandbox | `https://www.sandbox.paypal.com/web-sdk/v6/core` |
| Production | `https://www.paypal.com/web-sdk/v6/core` |

REST API hosts (server-side calls):

| Environment | Base URL |
|-------------|----------|
| Sandbox | `https://api-m.sandbox.paypal.com` |
| Production | `https://api-m.paypal.com` |

---

## Sinatra — `views/checkout.erb`

```erb
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Checkout — Expanded</title>
  <style>
    #card-number, #card-expiry, #card-cvv, #card-name { min-height: 2.5rem; margin-bottom: 0.75rem; }
  </style>
</head>
<body>
  <h1>Checkout</h1>

  <div id="paypal-buttons"></div>

  <form id="card-form">
    <div id="card-number"></div>
    <div id="card-expiry"></div>
    <div id="card-cvv"></div>
    <div id="card-name"></div>
    <button type="submit" id="card-pay-button">Pay with card</button>
  </form>

  <% if ENV['PAYPAL_ENVIRONMENT'].to_s.downcase == 'production' %>
    <script src="https://www.paypal.com/web-sdk/v6/core"></script>
  <% else %>
    <script src="https://www.sandbox.paypal.com/web-sdk/v6/core"></script>
  <% end %>

  <script>
    window.__PAYPAL_CLIENT_ID__ = <%= JSON.generate(ENV.fetch('PAYPAL_CLIENT_ID')) %>;
  </script>
  <script src="/checkout-expanded.js" defer></script>
</body>
</html>
```

Register the route:

```ruby
# app.rb
require "sinatra"

get "/checkout" do
  erb :checkout
end
```

Card field mount logic lives in **`card-fields-integration.md`** (separate JS file keeps PCI boundaries clear).

---

## v6 — `createInstance` with `card-fields` (in `/public/checkout-expanded.js`)

```javascript
async function initExpandedCheckoutV6() {
  const tokenRes = await fetch('/paypal-api/auth/browser-safe-client-token');
  const { accessToken: clientToken, expiresIn } = await tokenRes.json();

  const sdk = await window.paypal.createInstance({
    clientId: window.__PAYPAL_CLIENT_ID__,
    clientToken,
    components: ['paypal-payments', 'card-fields'],
    pageType: 'checkout',
  });

  const eligible = await sdk.findEligibleMethods({ currencyCode: 'USD' });
  return { sdk, eligible, clientToken };
}
```

---

## v5 — alternative script tag (same ERB pattern)

```erb
<% base = ENV['PAYPAL_ENVIRONMENT'].to_s.downcase == 'production' ? 'https://www.paypal.com' : 'https://www.sandbox.paypal.com' %>
<script src="<%= base %>/sdk/js?client-id=<%= ENV['PAYPAL_CLIENT_ID'] %>&components=buttons,card-fields&currency=USD"></script>
```

---

## Rails notes

- Place ERB in `app/views/checkout/show.html.erb` (or Haml/Slim equivalent).
- Use `<%= javascript_include_tag ... %>` or `tag.script` with the correct sandbox vs production host.
- Never embed `PAYPAL_CLIENT_SECRET` in views; only **public** `PAYPAL_CLIENT_ID` and token from a secure endpoint.

## Common issues

| Issue | Resolution |
|-------|------------|
| Only buttons, no card | Missing `card-fields` in `components`. |
| Wrong domain | Use sandbox script for sandbox client IDs. |

## Best practices

- Initialize the SDK once per page and reuse the instance.
- Keep `currencyCode` consistent across eligibility, create order, and capture.
