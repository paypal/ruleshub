# Capture Order — Expanded Checkout (Card Response Fields)

Capture with **POST** `/v2/checkout/orders/{order_id}/capture`.

| Environment | URL pattern |
|-------------|-------------|
| Sandbox | `https://api-m.sandbox.paypal.com/v2/checkout/orders/{order_id}/capture` |
| Production | `https://api-m.paypal.com/v2/checkout/orders/{order_id}/capture` |

Use the **server** OAuth access token. After capture, inspect **card-specific** fields for brand, last digits, and **3DS / liability** before fulfillment.

## API endpoint

| Method | Path |
|--------|------|
| POST | `/v2/checkout/orders/{id}/capture` |

## Express — POST `/paypal-api/checkout/orders/:orderId/capture`

```javascript
import express from 'express';
import axios from 'axios';
import crypto from 'node:crypto';

const app = express();
app.use(express.json());

const PAYPAL_BASE_URL =
  process.env.PAYPAL_ENVIRONMENT === 'production'
    ? 'https://api-m.paypal.com'
    : 'https://api-m.sandbox.paypal.com';

async function getPayPalAccessToken() {
  const auth = Buffer.from(
    `${process.env.PAYPAL_CLIENT_ID}:${process.env.PAYPAL_CLIENT_SECRET}`
  ).toString('base64');
  const { data } = await axios.post(
    `${PAYPAL_BASE_URL}/v1/oauth2/token`,
    'grant_type=client_credentials',
    {
      headers: {
        Authorization: `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    }
  );
  return data.access_token;
}

app.post('/paypal-api/checkout/orders/:orderId/capture', async (req, res) => {
  const { orderId } = req.params;
  try {
    const accessToken = await getPayPalAccessToken();

    const { data } = await axios.post(
      `${PAYPAL_BASE_URL}/v2/checkout/orders/${encodeURIComponent(orderId)}/capture`,
      {},
      {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
          'PayPal-Request-Id': crypto.randomUUID(),
        },
      }
    );

    const capture = extractCapturePayload(data);
    res.json(capture);
  } catch (error) {
    const debugId = error.response?.headers?.['paypal-debug-id'];
    console.error('capture', error.response?.data || error.message, debugId);
    res.status(error.response?.status || 500).json({
      error: 'CAPTURE_FAILED',
      details: error.response?.data,
      debugId,
    });
  }
});
```

## Extract card-specific response (brand, last digits, 3DS, liability)

```javascript
function extractCapturePayload(orderData) {
  const purchaseUnit = orderData?.purchase_units?.[0];
  const payments = purchaseUnit?.payments?.captures || [];
  const cap = payments[0] || {};

  const card = cap.payment_source?.card || orderData?.payment_source?.card;

  const authenticationResult = card?.authentication_result;
  const threeDSecure = authenticationResult?.three_d_secure;
  const liabilityShift = authenticationResult?.liability_shift; // YES | NO | POSSIBLE | UNKNOWN

  return {
    orderId: orderData.id,
    status: orderData.status,
    captureId: cap.id,
    captureStatus: cap.status,
    amount: cap.amount,
    card: card
      ? {
          brand: card.brand,
          last_digits: card.last_digits,
          type: card.type,
          authentication_result: authenticationResult
            ? {
                liability_shift: liabilityShift,
                three_d_secure: threeDSecure,
              }
            : undefined,
        }
      : undefined,
    raw: orderData,
  };
}
```

## Business rule — check liability before fulfillment

```javascript
function shouldFulfillCardCapture(extracted) {
  const shift = extracted?.card?.authentication_result?.liability_shift;
  if (!shift) return true; // Non-card or no auth data — apply your policy

  if (shift === 'YES' || shift === 'POSSIBLE') {
    return true;
  }
  if (shift === 'NO') {
    return false; // High risk — do not ship; align with risk rules
  }
  if (shift === 'UNKNOWN') {
    return false; // Conservative default; adjust per your risk policy
  }
  return false;
}
```

## Common issues

| Issue | Resolution |
|-------|------------|
| Capture returns `INSTRUMENT_DECLINED` | See `error-handling.md`; do not retry blindly. |
| Missing `card` on response | Payment may be PayPal balance — branch on `payment_source`. |
| Liability `NO` on EU card | Expected for some failures — do not fulfill physical goods without policy. |

## Best practices

- Treat capture as the **money movement** confirmation for your reconciliation.
- Store **capture ID** and **PayPal fees** if returned for accounting.
- Combine with **webhooks** (`PAYMENT.CAPTURE.COMPLETED`) for async finality.
