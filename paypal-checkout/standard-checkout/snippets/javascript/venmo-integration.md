# Venmo (Client-Side) — Standard Checkout

Venmo through PayPal Checkout is subject to **eligibility**, **US** buyers, and **USD** for standard integrations. Always verify with `findEligibleMethods` before showing Venmo.

## Requirements (typical)

- **US** buyers (and US-oriented session where applicable)
- **USD** currency for the transaction
- Venmo app on mobile or linked account on web where supported

## JS SDK v6 — `createVenmoOneTimePaymentSession()` and `venmo-payments`

```html
<venmo-button id="venmo-button" hidden></venmo-button>
```

```javascript
async function onPayPalWebSdkLoaded() {
  const clientToken = await getBrowserSafeClientToken();

  const sdkInstance = await window.paypal.createInstance({
    clientToken,
    components: ['paypal-payments', 'venmo-payments'],
    pageType: 'checkout',
  });

  const eligible = await sdkInstance.findEligibleMethods({
    currencyCode: 'USD',
    countryCode: 'US',
  });

  if (!eligible.isEligible('venmo')) {
    console.info('Venmo not eligible');
    return;
  }

  const session = await sdkInstance.createVenmoOneTimePaymentSession({
    currencyCode: 'USD',
    orderId: 'ORDER_ID_FROM_SERVER',
  });

  document.getElementById('venmo-button').hidden = false;
  // Bind session start / submit per official v6 Venmo flow for your SDK version
  return session;
}
```

Replace `orderId` with the id from your server-created order (`create-order.md`).

## JS SDK v5 — `paypal.FUNDING.VENMO`

```javascript
paypal
  .Buttons({
    fundingSource: paypal.FUNDING.VENMO,
    createOrder: () => createOrderOnServer(),
    onApprove: (data) => captureOnServer(data.orderID),
  })
  .render('#venmo-button-container');
```

## Eligibility check (v6)

```javascript
const eligibleMethods = await sdkInstance.findEligibleMethods({
  currencyCode: 'USD',
  countryCode: 'US',
});

if (eligibleMethods.isEligible('venmo')) {
  /* show Venmo */
} else {
  /* show PayPal or other methods */
}
```

## Common issues

| Issue | Resolution |
|-------|------------|
| Venmo never appears | Confirm USD + US session; check dashboard and product enablement |
| Desktop vs mobile | UX differs; always offer PayPal fallback |
| `createInstance` missing Venmo | Include `venmo-payments` in `components` |

## Best practices

- Show **clear fallback** to PayPal.
- Never assume Venmo is available—**gate on eligibility**.
- Keep **secrets and order amounts on the server**; pass only `orderId` to the client session.
