# Apple Pay — Expanded Checkout (JS SDK v6)

Apple Pay through PayPal uses the **`applepay-payments`** component in **JS SDK v6**. Expanded Checkout stacks Apple Pay alongside PayPal buttons and Card Fields.

## SDK script URLs

| Environment | URL |
|-------------|-----|
| Sandbox | `https://www.sandbox.paypal.com/web-sdk/v6/core` |
| Production | `https://www.paypal.com/web-sdk/v6/core` |

## Initialize with `applepay-payments`

```javascript
const sdk = await window.paypal.createInstance({
  clientId: 'YOUR_CLIENT_ID',
  clientToken,
  components: ['paypal-payments', 'card-fields', 'applepay-payments'],
  pageType: 'checkout',
});
```

## Eligibility check

```javascript
const eligible = await sdk.findEligibleMethods({ currencyCode: 'USD' });
if (!eligible?.isApplePayEligible) {
  document.getElementById('apple-pay-container').style.display = 'none';
}
```

Also verify **`window.ApplePaySession`** exists when required by the integration path.

## Domain verification

Apple Pay on the web requires **domain verification** with Apple (associated domain / verification file). PayPal’s docs describe how to complete merchant setup in the PayPal dashboard and Apple:

- [Apple Pay with JS SDK v6](https://docs.paypal.ai/payments/methods/digital-wallets/apple-pay)
- [Apple Pay on developer.paypal.com](https://developer.paypal.com/docs/checkout/apm/apple-pay/)

Host the verification file at **`/.well-known/apple-developer-merchantid-domain-association`** on your domain.

## Safari / iOS and HTTPS

- **Safari** (macOS) and **Safari on iOS** are the primary supported browsers for Apple Pay on the web.
- **HTTPS** is required for production pages.

```javascript
function applePaySupported() {
  return window.ApplePaySession && ApplePaySession.canMakePayments();
}
```

## Orders API — `payment_source.apple_pay`

When creating the order server-side for Apple Pay, use **`payment_source.apple_pay`** per the Orders API schema (token returned from the Apple Pay sheet / SDK):

```javascript
const orderBody = {
  intent: 'CAPTURE',
  purchase_units: [
    {
      amount: { currency_code: 'USD', value: '25.00' },
    },
  ],
  payment_source: {
    apple_pay: {
      /* attributes: payment data / token fields per current API version */
    },
  },
};
```

Exact nested fields follow PayPal’s current **Orders v2** reference for `payment_source.apple_pay` — generate bodies from the live schema in your integration.

## Express — placeholder route

```javascript
app.post('/paypal-api/checkout/orders/create-apple-pay', async (req, res) => {
  try {
    const accessToken = await getPayPalAccessToken();
    const { applePayPaymentSource, amount, currencyCode } = req.body;

    const payload = {
      intent: 'CAPTURE',
      purchase_units: [
        { amount: { currency_code: currencyCode, value: Number(amount).toFixed(2) } },
      ],
      payment_source: {
        apple_pay: applePayPaymentSource,
      },
    };

    const { data } = await axios.post(`${PAYPAL_BASE_URL}/v2/checkout/orders`, payload, {
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
        'PayPal-Request-Id': crypto.randomUUID(),
      },
    });

    res.json({ id: data.id, status: data.status });
  } catch (error) {
    const debugId = error.response?.headers?.['paypal-debug-id'];
    res.status(error.response?.status || 500).json({ error: 'CREATE_FAILED', debugId });
  }
});
```

## Common issues

| Issue | Resolution |
|-------|------------|
| Button never appears | Domain not verified; wrong browser; not HTTPS. |
| `NOT_ELIGIBLE` | Merchant or currency not supported; check dashboard. |
| Token mismatch | Ensure client Apple Pay payload maps to `payment_source.apple_pay` schema. |

## Best practices

- Hide Apple Pay until **eligible** and **supported**.
- Test on **real devices** with sandbox Apple IDs where applicable.
- Keep **amount** server-validated to match the Apple Pay line items.
