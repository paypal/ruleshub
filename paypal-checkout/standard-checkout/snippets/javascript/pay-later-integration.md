# Pay Later (Client-Side) — Standard Checkout

Pay Later (Pay in 4 / messaging) availability depends on **buyer eligibility**, **currency**, and **region**. Always check eligibility before showing Pay Later UI.

## JS SDK v6 — `createPayLaterOneTimePaymentSession()`

After `createInstance`, use the Pay Later session API (names may align with your SDK version; consult current [docs.paypal.ai](https://docs.paypal.ai/) Pay Later integration for exact method names).

```javascript
async function setupPayLater(sdkInstance, { currencyCode, orderId }) {
  const eligible = await sdkInstance.findEligibleMethods({
    currencyCode,
    countryCode: 'US',
  });

  if (!eligible.isEligible('paylater')) {
    console.info('Pay Later not eligible for this buyer/session');
    return null;
  }

  // Example pattern — align with official v6 Pay Later docs for your SDK version
  const session = await sdkInstance.createPayLaterOneTimePaymentSession({
    currencyCode,
    orderId,
  });

  return session;
}
```

Mount Pay Later alongside `paypal-payments` / messaging components as required by your integration package.

## v6 — Components and messaging

Include the components your integration requires (e.g. messaging web components or script add-ons) so buyers see accurate **Pay Later** legal messaging.

```javascript
const sdkInstance = await window.paypal.createInstance({
  clientToken,
  components: ['paypal-payments', 'paylater-messaging'], // per docs for your build
  pageType: 'checkout',
});
```

(Exact component strings depend on the SDK bundle—verify against current documentation.)

## JS SDK v5 — `paypal.FUNDING.PAYLATER`

```javascript
paypal
  .Buttons({
    fundingSource: paypal.FUNDING.PAYLATER,
    createOrder: () => createOrderOnServer(),
    onApprove: (data) => captureOnServer(data.orderID),
    onError: (err) => console.error(err),
  })
  .render('#paylater-button-container');
```

## Eligibility check (v6)

```javascript
const eligibleMethods = await sdkInstance.findEligibleMethods({
  currencyCode: 'USD',
});
if (eligibleMethods.isEligible('paylater')) {
  // render Pay Later button / session
}
```

## Pay Later messaging (v5 / site)

Use PayPal **marketing components** or hosted messaging where supported so terms and offers stay compliant and up to date.

## Common issues

| Issue | Resolution |
|-------|------------|
| Button hidden | Buyer ineligible; offer standard PayPal |
| Wrong locale/currency | Pay Later is region-specific; use supported currency |
| Stale messaging | Use official messaging components or current copy |

## Best practices

- Always provide a **fallback** payment method.
- Do not promise Pay Later before eligibility is confirmed.
- Keep **order creation and amounts on the server**.
