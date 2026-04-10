# Card Fields Integration — Client JS (Ruby app serves static assets)

Your **Sinatra** or **Rails** app serves HTML/ERB and static JS; **Card Fields** run in the browser. PayPal hosts the actual card inputs — you provide containers and call the SDK.

REST calls from Ruby use:

| Environment | Base URL |
|-------------|----------|
| Sandbox | `https://api-m.sandbox.paypal.com` |
| Production | `https://api-m.paypal.com` |

---

## v6 — Card Fields + create order / approve

Assume `sdk` comes from `createInstance` with `components: ['paypal-payments', 'card-fields']` (see `sdk-initialization.md`). Wire **`createOrder`** and **`onApprove`** to your Sinatra routes (e.g. `POST /paypal-api/checkout/orders/create`).

```javascript
// public/checkout-card-fields.js — illustrative; align with official v6 Card Fields docs
async function mountCardFields(sdk, { currencyCode }) {
  const cardFields = sdk.CardFields({
    style: {
      input: { 'font-size': '16px' },
    },
    createOrder: async () => {
      const res = await fetch('/paypal-api/checkout/orders/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: '50.00',
          currency_code: currencyCode,
          funding: 'card',
        }),
      });
      if (!res.ok) throw new Error('create_order_failed');
      const order = await res.json();
      return order.id;
    },
    onApprove: async (data) => {
      const res = await fetch(
        `/paypal-api/checkout/orders/${data.orderID}/capture`,
        { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' }
      );
      const capture = await res.json();
      return capture;
    },
    onError: (err) => console.error('card_fields_error', err),
  });

  await cardFields.render('#card-number', { field: 'number' });
  await cardFields.render('#card-expiry', { field: 'expiry' });
  await cardFields.render('#card-cvv', { field: 'cvv' });
  await cardFields.render('#card-name', { field: 'name' });

  document.getElementById('card-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    await cardFields.submit();
  });
}
```

> **Note:** Exact v6 method names (`CardFields`, `render` field names) follow [JS SDK v6 Card Fields](https://docs.paypal.ai/payments/methods/cards/js-sdk-v6-card-fields-one-time). Adjust to your SDK version.

---

## v5 — `paypal.CardFields` pattern

```javascript
paypal.CardFields({
  createOrder: () => fetch('/paypal-api/checkout/orders/create', { /* ... */ }).then((r) => r.json()).then((o) => o.id),
  onApprove: (data) => fetch(`/paypal-api/checkout/orders/${data.orderID}/capture`, { method: 'POST' }).then((r) => r.json()),
}).render('#card-number');
```

Load v5 script with `components=buttons,card-fields` (see `sdk-initialization.md`).

---

## Server contract (Ruby)

Your **`create-order.md`** route must build Orders API v2 with:

```json
"payment_source": {
  "card": {
    "experience_context": { "return_url": "...", "cancel_url": "..." },
    "attributes": { "verification": { "method": "SCA_WHEN_REQUIRED" } }
  }
}
```

Do **not** use deprecated `application_context` for these flows.

---

## Rails notes

- Put this file in `app/javascript/checkout_card_fields.js` with your bundler, or `vendor/assets` if legacy pipeline.
- Use `asset_path` / `javascript_include_tag` in the layout; keep **HTTPS** in production.

## Best practices

- Never log full card-related payloads from the client.
- Handle `onError` and surface user-safe messages (see `error-handling.md`).
