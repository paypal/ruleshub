# Venmo — Client-Side (Standard Checkout)

**Venmo** is available to eligible US buyers when the integration and buyer profile meet PayPal requirements. The **server** order/capture flow is unchanged; Venmo is selected in the PayPal-hosted experience or via a dedicated funding button.

See: [Pay with Venmo](https://developer.paypal.com/docs/checkout/pay-with-venmo/).

---

## JS SDK v5 — Venmo button

Load the SDK with Venmo enabled (US flows typically use USD):

```html
<script
  src="https://www.paypal.com/sdk/js?client-id=YOUR_CLIENT_ID&currency=USD&enable-funding=venmo"></script>
```

Sandbox:

```html
<script
  src="https://www.sandbox.paypal.com/sdk/js?client-id=YOUR_CLIENT_ID&currency=USD&enable-funding=venmo"></script>
```

Dedicated Venmo button:

```javascript
if (paypal.isFundingEligible(paypal.FUNDING.VENMO)) {
  paypal
    .Buttons({
      fundingSource: paypal.FUNDING.VENMO,
      createOrder: async () => {
        const res = await fetch('/paypal-api/checkout/orders/create', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ amount: '15.00', currency_code: 'USD' }),
        });
        const { id } = await res.json();
        return id;
      },
      onApprove: async (data) => {
        await fetch(`/paypal-api/checkout/orders/${data.orderID}/capture`, { method: 'POST' });
      },
    })
    .render('#venmo-button-container');
}
```

---

## JS SDK v6 — eligibility

After `createInstance`, pass `countryCode: 'US'` to improve regional method detection:

```javascript
const eligible = await sdkInstance.findEligibleMethods({
  currencyCode: 'USD',
  countryCode: 'US',
});

if (eligible.isEligible('venmo')) {
  // Show <paypal-button> or Venmo-specific component per your integration guide
}
```

Use the same server-side **create order** and **capture** endpoints as other PayPal methods.

---

## Sinatra — ERB

```erb
<div id="venmo-button-container"></div>
<% if @paypal_env == "production" %>
  <script src="https://www.paypal.com/sdk/js?client-id=<%= @paypal_client_id %>&currency=USD&enable-funding=venmo"></script>
<% else %>
  <script src="https://www.sandbox.paypal.com/sdk/js?client-id=<%= @paypal_client_id %>&currency=USD&enable-funding=venmo"></script>
<% end %>
<script src="/js/venmo-checkout.js"></script>
```

---

## Rails

- Same client-side script; serve `venmo-checkout.js` from `app/javascript` or `public/`.
- Ensure **mobile** and **in-app** browser testing—Venmo is mobile-centric.

---

## Best practices

- Always guard with `isFundingEligible` / `findEligibleMethods` before showing Venmo-only UI.
- Handle `onCancel` and `onError` for user abandonment.
