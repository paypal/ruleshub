# Card Fields integration — Client JavaScript (Expanded Checkout)

Client-side code to **render** Card Fields, apply **styling**, perform **basic validation** UX, and **submit** by creating/approving an order against your Spring Boot backend.

Use **`payment_source.card`** on the server when creating orders (see `create-order.md`). Do not collect raw PAN/CVV in your own inputs — the SDK hosts the fields.

## v6 — render card fields after `createInstance`

```javascript
async function setupCardFieldsV6(sdkInstance, currencyCode) {
  const eligible = await sdkInstance.findEligibleMethods({ currencyCode });
  if (!eligible.isEligible('card')) {
    console.warn('Card not eligible');
    return;
  }

  const cardField = await sdkInstance.createCardFields({
    style: {
      input: {
        'font-size': '16px',
        color: '#1a1a1a'
      },
      '.invalid': { color: '#c00' }
    },
    inputEvents: {
      onChange: (data) => {
        console.debug('card fields change', data);
      }
    }
  });

  await cardField.render('#card-fields-container');

  document.getElementById('pay-button').onclick = async () => {
    await cardField.submit({
      createOrder: async () => {
        const res = await fetch('/api/paypal/orders', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            intent: 'CAPTURE',
            purchase_units: [{
              amount: { currency_code: currencyCode, value: '10.00' }
            }]
          })
        });
        const order = await res.json();
        return order.id;
      },
      onApprove: async (data) => {
        await fetch(`/api/paypal/orders/${data.orderID}/capture`, { method: 'POST' });
        window.location.href = '/success';
      },
      onError: (e) => console.error(e)
    });
  };
}
```

Align method names with the current PayPal JS SDK v6 Card Fields reference.

## v5 — `CardFields`

```javascript
if (paypal.CardFields) {
  paypal.CardFields({
    style: { input: { 'font-size': '16px' } },
    createOrder: () => {
      return fetch('/api/paypal/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          intent: 'CAPTURE',
          purchase_units: [{
            amount: { currency_code: 'USD', value: '10.00' }
          }]
        })
      }).then((r) => r.json()).then((o) => o.id);
    },
    onApprove: (data) => {
      return fetch('/api/paypal/orders/' + data.orderID + '/capture', { method: 'POST' });
    },
    onError: (err) => console.error(err)
  }).render('#card-fields-container');
}
```

## Styling

Use the SDK `style` object for hosted fields (fonts, colors, padding) to match your site.

## Validation

Rely on the SDK for PCI-scoped field validation; disable your pay button until the SDK reports readiness.

## Submission flow

1. User completes Card Fields.
2. `createOrder` → Spring `POST` creates order with `payment_source.card` + `SCA_WHEN_REQUIRED`.
3. SDK may open **3DS** when required (`3ds-integration.md`).
4. `onApprove` → Spring `POST` capture (`capture-order.md`).
