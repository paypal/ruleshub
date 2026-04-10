# Card Fields Integration — Expanded Checkout (Core)

This is the **primary** client integration for Expanded Checkout: hosted **card number**, **expiry**, **CVV**, and **name** fields with your styling, validation hooks, and server-backed Orders API flows. You do **not** handle raw card data — PayPal maintains PCI scope.

## API surface (client)

| Concern | v6 | v5 |
|---------|----|-----|
| SDK components | `["paypal-payments", "card-fields"]` | `components=buttons,card-fields` |
| Card UI | Card payment session + field render into containers | `paypal.CardFields({ ... })` + `NumberField` / `ExpiryField` / `CVVField` / `NameField` |

Server endpoints stay the same: create order → buyer approves / 3DS as needed → capture (see `create-order.md`, `capture-order.md`, `3ds-integration.md`).

## v6 — Card payment session and render into containers

Patterns follow [JS SDK v6 Card Fields](https://docs.paypal.ai/payments/methods/cards/js-sdk-v6-card-fields-one-time). Exact method names may match the current `card-fields` component API — align with the latest reference when you wire production code.

```javascript
/**
 * Illustrative v6 flow: obtain sdk from createInstance({ components: ["paypal-payments", "card-fields"] })
 * then create a card session and mount fields.
 */
async function mountCardFieldsV6(sdk, options) {
  const { currencyCode, createOrderOnServer } = options;

  const cardComponent = sdk.getCardFields?.() || sdk.cardFields;
  if (!cardComponent) {
    throw new Error('Card Fields component not available');
  }

  const session = await cardComponent.createCardPaymentSession({
    async createOrder() {
      const res = await fetch('/paypal-api/checkout/orders/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          intent: 'CAPTURE',
          currencyCode,
          amount: options.amount,
          paymentMethod: 'card',
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'createOrder failed');
      return data.id;
    },
  });

  await session.renderFields({
    cardNumber: { container: '#card-number' },
    expirationDate: { container: '#card-expiry' },
    cvv: { container: '#card-cvv' },
    cardholderName: { container: '#card-name' },
    styles: {
      base: {
        fontSize: '16px',
        color: '#111827',
        '::placeholder': { color: '#9ca3af' },
      },
      invalid: { color: '#b91c1c' },
    },
  });

  session.on?.('fields:change', (payload) => {
    options.onValidationChange?.(payload);
  });

  return session;
}
```

## v5 — `CardFields` and field helpers

```javascript
async function mountCardFieldsV5() {
  if (!window.paypal || !paypal.CardFields) {
    throw new Error('PayPal CardFields not loaded — add components=buttons,card-fields');
  }

  const cardFields = paypal.CardFields({
    style: {
      base: {
        color: '#111827',
        fontSize: '16px',
        '::placeholder': { color: '#9ca3af' },
      },
      invalid: { color: '#b91c1c' },
      input: {
        'font-size': '16px',
      },
    },
    createOrder: async () => {
      const res = await fetch('/paypal-api/checkout/orders/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ intent: 'CAPTURE', currencyCode: 'USD', amount: '10.00', paymentMethod: 'card' }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'createOrder failed');
      return data.id;
    },
    onApprove: async (data) => {
      const res = await fetch(`/paypal-api/checkout/orders/${data.orderID}/capture`, {
        method: 'POST',
      });
      const capture = await res.json();
      if (!res.ok) throw new Error(capture.message || 'capture failed');
      return capture;
    },
    onError: (err) => {
      console.error('CardFields error', err);
    },
  });

  if (cardFields.isEligible()) {
    cardFields.NumberField({ container: '#card-number' }).render();
    cardFields.ExpiryField({ container: '#card-expiry' }).render();
    cardFields.CVVField({ container: '#card-cvv' }).render();
    cardFields.NameField({ container: '#card-name' }).render();
  }

  return cardFields;
}
```

## Styling (font, color, border, placeholder)

- Use the SDK `style` / `styles` object (v5 `style`, v6 `styles`) for **font**, **color**, and **placeholder** — not CSS on raw inputs (iframes).
- Match input height to your form layout; avoid clipping descenders.

```javascript
const cardFieldStyles = {
  base: {
    fontSize: '16px',
    fontFamily: 'system-ui, sans-serif',
    color: '#111827',
    '::placeholder': { color: '#9ca3af' },
  },
  invalid: { color: '#b91c1c' },
};
```

## `onChange` / validation events

```javascript
function wireFieldValidation(sessionOrFields, onValidChange) {
  let state = { number: false, expiry: false, cvv: false, name: false };

  function update() {
    const valid = state.number && state.expiry && state.cvv && state.name;
    onValidChange(valid, state);
  }

  // v6: session.on('fields:change', ...); v5: use onChange callbacks if exposed by your SDK version
  sessionOrFields.on?.('fields:change', (evt) => {
    state = { ...state, ...evt.fieldStates };
    update();
  });
}
```

Disable **Pay** until fields are valid and your own terms checkbox (if any) is checked.

## Form submission handling

```javascript
document.getElementById('card-form')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  try {
    await cardFields.submit(); // v5
    // v6: session.submit() or equivalent from current API
  } catch (err) {
    console.error(err);
  }
});
```

Prevent double submit: disable the button at start and re-enable on error.

## Card brand icon (detection)

- Prefer **SDK-provided** brand indicators when available (v6 session APIs may expose network events).
- If you show a custom icon, update from **BIN** or **brand** events only as documented — do not infer from partial typed digits in your own inputs (you should not have access to full PAN).

```javascript
session.on?.('card:network', (info) => {
  const brand = info?.brand || info?.paymentMethod?.card?.brand;
  updateBrandIcon(brand);
});
```

## PCI compliance note

- Card Fields are **hosted by PayPal** — you remain out of PCI scope for raw card data.
- Display required **disclosure** text (e.g. link to PayPal payment methods / privacy) per PayPal checkout requirements.

## Common issues

| Issue | Resolution |
|-------|------------|
| Empty iframes | Container elements must exist and have dimensions before render. |
| Submit does nothing | Ensure `createOrder` returns a valid order ID; check network tab. |
| Styling ignored | Use SDK style keys, not external CSS on iframe internals. |

## Best practices

- Use **HTTPS** everywhere.
- Keep **one** order create per user action; use idempotency on the server.
- Align **currency** and **amount** with server validation.
