# Pay Later — Client-Side (Standard Checkout)

**Pay Later** (PayPal Credit / installment messaging in some regions) is enabled through the **JavaScript SDK** and buyer eligibility. Your **server** still creates and captures orders the same way; funding source is chosen in the PayPal UI.

Use the **same** `client-id` / **client token** flow as core PayPal. Regional availability and currency rules apply—see [Pay Later US](https://developer.paypal.com/docs/checkout/pay-later/us/).

---

## JS SDK v5 — enable Pay Later in the button

Load the SDK with `enable-funding=paylater` (and disable funding you do not want):

```html
<script
  src="https://www.paypal.com/sdk/js?client-id=YOUR_CLIENT_ID&currency=USD&enable-funding=paylater&disable-funding=card"></script>
```

Sandbox example:

```html
<script
  src="https://www.sandbox.paypal.com/sdk/js?client-id=YOUR_CLIENT_ID&currency=USD&enable-funding=paylater"></script>
```

```javascript
paypal
  .Buttons({
    fundingSource: paypal.FUNDING.PAYLATER,
    createOrder: async () => {
      const res = await fetch('/paypal-api/checkout/orders/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: '49.99', currency_code: 'USD' }),
      });
      const { id } = await res.json();
      return id;
    },
    onApprove: async (data) => {
      await fetch(`/paypal-api/checkout/orders/${data.orderID}/capture`, { method: 'POST' });
    },
  })
  .render('#paylater-button-container');
```

You can render **multiple** button instances (`paypal.FUNDING.PAYPAL`, `paypal.FUNDING.PAYLATER`) pointing at the same `createOrder`/`onApprove` handlers.

---

## JS SDK v6 — web component

Include the v6 core script (sandbox vs live per `sdk-initialization.md`), then use the **Pay Later** component when eligible:

```html
<paypal-pay-later-button id="pl-button" hidden></paypal-pay-later-button>
```

```javascript
const eligible = await sdkInstance.findEligibleMethods({ currencyCode: 'USD' });
if (eligible.isEligible('paylater')) {
  document.getElementById('pl-button').hidden = false;
}
```

Wire the session / `createOrder` callback to your Ruby **POST** `/paypal-api/checkout/orders/create` route as with the standard PayPal button.

---

## Sinatra — ERB snippet

Pass only the public client id for v5; for v6 use the client token endpoint from **`client-token-generation.md`**.

```erb
<% if @paypal_env == "production" %>
  <script src="https://www.paypal.com/sdk/js?client-id=<%= @paypal_client_id %>&currency=USD&enable-funding=paylater"></script>
<% else %>
  <script src="https://www.sandbox.paypal.com/sdk/js?client-id=<%= @paypal_client_id %>&currency=USD&enable-funding=paylater"></script>
<% end %>
<div id="paylater-button-container"></div>
```

---

## Rails

- Same `script` tags in the layout or view; move `client_id` to credentials or `ENV`.
- No extra Ruby route is required for Pay Later **selection**—only your existing order/capture routes.

---

## Best practices

- Do not assume Pay Later is available: always check **eligibility** (v6) or handle missing funding in UI.
- Keep amounts authoritative on the server (`create-order.md`).
