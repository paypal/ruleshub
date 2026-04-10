# Error Handling — Card-Specific (Expanded Checkout)

Expanded Checkout surfaces **card declines**, **3DS authentication failures**, **field validation** errors, and **server** errors. Handle each layer: hosted fields → order create → approve/capture.

## Card decline codes (examples)

Common `issue` / `name` values in API responses (see [Card decline errors](https://developer.paypal.com/docs/checkout/advanced/card-decline-errors/)):

| Code / issue | Meaning | User-facing message (example) |
|--------------|---------|-------------------------------|
| `INSTRUMENT_DECLINED` | Issuer or network declined | “Your bank declined this card. Try another payment method.” |
| `CARD_EXPIRED` | Expiry in the past | “This card has expired. Check the date or use another card.” |
| `CVV_FAILURE` | CVV mismatch | “Security code doesn’t match. Re-enter the CVV.” |
| `INSUFFICIENT_FUNDS` | Not enough balance | “Insufficient funds. Try another card or payment method.” |

Parse error bodies from **create order**, **capture**, and SDK `onError` callbacks.

## 3DS errors

| Pattern | Meaning | Action |
|---------|---------|--------|
| `AUTHENTICATION_FAILURE` | 3DS failed technically | Retry once; then different card/method |
| `AUTHENTICATION_REJECTED` | Customer failed step-up | Prompt another method |

Also check capture **`authentication_result`** (see `3ds-integration.md`).

## Card field validation errors

```javascript
function mapFieldErrorToMessage(field, code) {
  const map = {
    INVALID_NUMBER: 'Please enter a valid card number.',
    INVALID_EXPIRY: 'Please enter a valid expiry date.',
    INVALID_CVV: 'Please enter a valid security code.',
  };
  return map[code] || 'Please check your card details.';
}
```

Wire this to **`onChange`** / **`fields:change`** events from Card Fields.

## Server — capture failure handling

```javascript
app.post('/paypal-api/checkout/orders/:orderId/capture', async (req, res) => {
  try {
    const { data } = await axios.post(/* ... */);
    res.json(data);
  } catch (error) {
    const debugId = error.response?.headers?.['paypal-debug-id'];
    const details = error.response?.data;

    const issue = details?.details?.[0]?.issue || details?.name;
    if (issue === 'INSTRUMENT_DECLINED' || issue === 'PAYMENT_DENIED') {
      return res.status(422).json({
        error: 'PAYMENT_DECLINED',
        userMessage: 'Your payment could not be completed. Try another card.',
        debugId,
      });
    }

    res.status(error.response?.status || 500).json({
      error: 'CAPTURE_FAILED',
      details,
      debugId,
    });
  }
});
```

## Retry logic (server)

- **Do not** auto-retry capture for **declines** — you may double-charge intent or confuse reconciliation.
- **Safe retries:** network timeouts with **same** `PayPal-Request-Id` only where idempotency is defined (typically **create order** with same key — follow PayPal idempotency docs).
- Log **`paypal-debug-id`** on every failure.

```javascript
async function captureWithLogging(orderId, accessToken) {
  try {
    return await axios.post(
      `${PAYPAL_BASE_URL}/v2/checkout/orders/${orderId}/capture`,
      {},
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          'PayPal-Request-Id': crypto.randomUUID(),
        },
      }
    );
  } catch (err) {
    console.error('capture failed', {
      debugId: err.response?.headers?.['paypal-debug-id'],
      data: err.response?.data,
    });
    throw err;
  }
}
```

## User-friendly messages

- Avoid exposing raw processor codes to end users.
- Offer **PayPal balance** or **another card** as alternatives.
- For **3DS**, suggest checking SMS/OTP apps.

## Common issues

| Issue | Resolution |
|-------|------------|
| Generic “Something went wrong” | Map known issues; log full body server-side only. |
| Repeated declines on test cards | Use [sandbox card tables](https://developer.paypal.com/tools/sandbox/card-testing/). |
| Field errors not clearing | Reset field state on `onChange` after user edits. |

## Best practices

- Centralize **error mapping** in one module for API + SDK.
- Track **fraud signals** separately from UX messages (do not accuse users).
- Include **debug ID** in support tickets, not in user-visible banners.
