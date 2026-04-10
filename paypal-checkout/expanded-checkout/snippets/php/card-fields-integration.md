# Card Fields Integration — Client JavaScript (Expanded Checkout)

Card Fields render **hosted** inputs for card number, expiry, CVV, and name. Your server still creates and captures orders with **`payment_source.card`** (see `create-order.md`). This snippet shows **client-side** patterns; adapt to JS SDK **v5** or **v6** per your chosen SDK.

## Prerequisites

- SDK loaded with **`card-fields`** (v5: `components=buttons,card-fields`; v6: `components: ['paypal-payments', 'card-fields']`).
- Empty DOM containers for each field (see `sdk-initialization.md`).
- Server routes: **create order** → return `orderID`; **capture** after approval.

## v6 — conceptual flow

After `createInstance` with `card-fields`:

1. Obtain **eligible** methods via `findEligibleMethods({ currencyCode })`.
2. Use the Card Fields API from the v6 documentation to **mount** fields into `#card-number`, `#card-expiry`, `#card-cvv`, `#card-name`.
3. On submit, call your `createOrder` server endpoint, then submit the card flow with the returned `orderID` (SDK handles 3DS when required — see `3ds-integration.md`).

```javascript
/**
 * Pseudocode — align field/method names with current JS SDK v6 Card Fields docs:
 * https://docs.paypal.ai/payments/methods/cards/js-sdk-v6-card-fields-one-time
 */
async function mountCardFields(sdkInstance, selectors) {
  const card = await sdkInstance.CardFields({
    style: {
      input: { 'font-size': '16px' },
    },
    createOrder: async () => {
      const res = await fetch('/paypal-api/checkout/orders/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: { currency_code: 'USD', value: '10.00' },
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'create order failed');
      return data.id;
    },
    onApprove: async (data) => {
      const res = await fetch(`/paypal-api/checkout/orders/${data.orderID}/capture`, {
        method: 'POST',
      });
      const cap = await res.json();
      if (!res.ok) throw new Error(cap.error || 'capture failed');
      window.location.href = '/thank-you';
    },
    onError: (err) => console.error(err),
  });

  if (card.isEligible()) {
    card.NumberField().render(selectors.number);
    card.ExpiryField().render(selectors.expiry);
    card.CVVField().render(selectors.cvv);
    card.NameField().render(selectors.name);
  }
}
```

## v5 — `paypal.CardFields`

```javascript
if (window.paypal && paypal.CardFields) {
  const cardField = paypal.CardFields({
    createOrder: async () => {
      const res = await fetch('/paypal-api/checkout/orders/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: { currency_code: 'USD', value: '10.00' },
        }),
      });
      const j = await res.json();
      return j.id;
    },
    onApprove: async (data) => {
      await fetch(`/paypal-api/checkout/orders/${data.orderID}/capture`, { method: 'POST' });
    },
    style: {
      input: { 'font-size': '16px' },
    },
  });

  if (cardField.isEligible()) {
    cardField.render({
      number: { selector: '#card-number', placeholder: 'Card number' },
      expiry: { selector: '#card-expiry', placeholder: 'MM/YY' },
      cvv: { selector: '#card-cvv', placeholder: 'CVV' },
      name: { selector: '#card-name', placeholder: 'Name on card' },
    });
  }
}
```

## Server contract (PHP)

Your **`POST /paypal-api/checkout/orders/create`** must return JSON including the **order `id`** from PayPal. That handler should use **`payment_source.card`** (not deprecated `application_context`) — see `create-order.md`.

## PCI

Do not read raw PAN/CVV into your own variables; Card Fields keeps card data in PayPal-hosted fields.
