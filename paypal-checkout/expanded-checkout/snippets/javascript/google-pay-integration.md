# Google Pay — Expanded Checkout (JS SDK v6)

Google Pay integrates via the **`googlepay-payments`** component in **JS SDK v6**, alongside PayPal and Card Fields.

## SDK script URLs

| Environment | URL |
|-------------|-----|
| Sandbox | `https://www.sandbox.paypal.com/web-sdk/v6/core` |
| Production | `https://www.paypal.com/web-sdk/v6/core` |

## Initialize with `googlepay-payments`

```javascript
const sdk = await window.paypal.createInstance({
  clientId: 'YOUR_CLIENT_ID',
  clientToken,
  components: ['paypal-payments', 'card-fields', 'googlepay-payments'],
  pageType: 'checkout',
});
```

## Eligibility check

```javascript
const eligible = await sdk.findEligibleMethods({ currencyCode: 'USD' });
if (!eligible?.isGooglePayEligible) {
  document.getElementById('google-pay-container').style.display = 'none';
}
```

Also confirm **`google.payments.api.PaymentsClient`** or the PayPal wrapper is available per the current SDK.

## Browser support and HTTPS

- Google Pay on the web works in **Chrome** and other supported Chromium browsers; availability varies by region and device.
- **HTTPS** is required in production.

```javascript
function googlePayLikelySupported() {
  return location.protocol === 'https:' && typeof window.google !== 'undefined';
}
```

## Orders API — `payment_source.google_pay`

Server-side order creation uses **`payment_source.google_pay`** with the payment data from the Google Pay sheet:

```javascript
const orderBody = {
  intent: 'CAPTURE',
  purchase_units: [
    {
      amount: { currency_code: 'USD', value: '18.50' },
    },
  ],
  payment_source: {
    google_pay: {
      /* attributes per Orders API v2 — payment data from Google Pay */
    },
  },
};
```

Populate nested fields per the live **Orders v2** schema for `payment_source.google_pay`.

## Client — illustrative flow

```javascript
async function mountGooglePay(sdk, container) {
  const googlePay = sdk.googlePay || sdk.getGooglePay?.();
  if (!googlePay) {
    console.warn('Google Pay component not available');
    return;
  }
  await googlePay.render(container, {
    createOrder: async () => {
      const res = await fetch('/paypal-api/checkout/orders/create-google-pay', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currencyCode: 'USD', amount: '18.50' }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'create order failed');
      return data.id;
    },
    onApprove: async (data) => {
      await fetch(`/paypal-api/checkout/orders/${data.orderID}/capture`, { method: 'POST' });
    },
  });
}
```

Method names (`render`, callbacks) must match the current v6 `googlepay-payments` API.

## Express — create order stub

```javascript
app.post('/paypal-api/checkout/orders/create-google-pay', async (req, res) => {
  try {
    const accessToken = await getPayPalAccessToken();
    const { googlePayPaymentSource, amount, currencyCode } = req.body;

    const payload = {
      intent: 'CAPTURE',
      purchase_units: [
        { amount: { currency_code: currencyCode, value: Number(amount).toFixed(2) } },
      ],
      payment_source: {
        google_pay: googlePayPaymentSource,
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
| Component missing | Add `googlepay-payments` to `components` array. |
| Not eligible | Currency/country or account capability; check dashboard. |
| Schema errors on create | Match `google_pay` object to current API; update from reference docs. |

## Best practices

- Show Google Pay only when **eligible** and **supported**.
- Validate **amount** and **currency** on the server.
- Test in **sandbox** with Google Pay test environment when available.
