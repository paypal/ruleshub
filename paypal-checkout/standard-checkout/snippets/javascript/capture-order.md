# Capture Order (Server-Side)

After the buyer approves the order, **capture** funds with:

**POST** `/v2/checkout/orders/{order_id}/capture`

- **Sandbox:** `https://api-m.sandbox.paypal.com/v2/checkout/orders/{order_id}/capture`
- **Production:** `https://api-m.paypal.com/v2/checkout/orders/{order_id}/capture`

## Express — POST `/paypal-api/checkout/orders/:orderId/capture`

```javascript
import express from 'express';
import axios from 'axios';

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

const app = express();
app.use(express.json());

app.post('/paypal-api/checkout/orders/:orderId/capture', async (req, res) => {
  const { orderId } = req.params;

  try {
    const accessToken = await getPayPalAccessToken();

    const response = await axios.post(
      `${PAYPAL_BASE_URL}/v2/checkout/orders/${encodeURIComponent(orderId)}/capture`,
      {},
      {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    const data = response.data;
    const captureId =
      data.purchase_units?.[0]?.payments?.captures?.[0]?.id || null;

    res.json({
      orderId: data.id,
      status: data.status,
      captureId,
      raw: data,
    });
  } catch (error) {
    const debugId = error.response?.headers?.['paypal-debug-id'];
    console.error('Capture failed', error.response?.data, debugId);
    res.status(error.response?.status || 500).json({
      error: 'CAPTURE_FAILED',
      message: error.response?.data?.message,
      debugId,
      details: error.response?.data?.details,
    });
  }
});
```

## Extract capture ID for refunds

The capture id is required for **POST** `/v2/payments/captures/{capture_id}/refund`.

```javascript
function extractCaptureId(orderPayload) {
  return (
    orderPayload?.purchase_units?.[0]?.payments?.captures?.[0]?.id ?? null
  );
}
```

## Optional: partial capture body

If your integration uses partial capture, supply `amount` per API docs:

```json
{
  "payment_source": {},
  "amount": {
    "currency_code": "USD",
    "value": "10.00"
  },
  "final_capture": false
}
```

(Exact schema depends on order state; see current Orders v2 documentation.)

## Error handling

- Log **`paypal-debug-id`** on every error response.
- Map `INSTRUMENT_DECLINED` and similar to user-friendly copy; keep technical ids in logs only.

## Common issues

| Issue | Resolution |
|-------|------------|
| `ORDER_NOT_APPROVED` | Capture only after buyer approval and valid order state |
| `CAPTURE_ALREADY_COMPLETED` | Treat as idempotent success if status matches your records |
| Missing `captureId` | Inspect full response; some errors return without captures |

## Best practices

- Persist `orderId` and `captureId` with your internal order.
- Prefer verifying large purchases with **webhooks** (`PAYMENT.CAPTURE.COMPLETED`) in addition to synchronous capture.
