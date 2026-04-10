# Refund Payment (Server-Side)

Refund a captured payment with:

**POST** `/v2/payments/captures/{capture_id}/refund`

- **Sandbox:** `https://api-m.sandbox.paypal.com/v2/payments/captures/{capture_id}/refund`
- **Production:** `https://api-m.paypal.com/v2/payments/captures/{capture_id}/refund`

You need the **capture id** from the capture response (see `capture-order.md`).

## Shared OAuth helper

```javascript
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
```

## Full refund

```javascript
async function refundCaptureFull(accessToken, captureId) {
  const { data } = await axios.post(
    `${PAYPAL_BASE_URL}/v2/payments/captures/${encodeURIComponent(
      captureId
    )}/refund`,
    {},
    {
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
    }
  );
  return data;
}
```

## Partial refund

```javascript
async function refundCapturePartial(accessToken, captureId, currencyCode, value) {
  const { data } = await axios.post(
    `${PAYPAL_BASE_URL}/v2/payments/captures/${encodeURIComponent(
      captureId
    )}/refund`,
    {
      amount: {
        currency_code: currencyCode,
        value: parseFloat(value).toFixed(2),
      },
    },
    {
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
    }
  );
  return data;
}
```

## Express — POST `/paypal-api/payments/captures/:captureId/refund`

```javascript
import express from 'express';
import axios from 'axios';

const app = express();
app.use(express.json());

app.post('/paypal-api/payments/captures/:captureId/refund', async (req, res) => {
  const { captureId } = req.params;
  const { amount, currency_code = 'USD' } = req.body;

  try {
    const accessToken = await getPayPalAccessToken();
    const payload =
      amount != null
        ? {
            amount: {
              currency_code: currency_code,
              value: parseFloat(amount).toFixed(2),
            },
          }
        : {};

    const response = await axios.post(
      `${PAYPAL_BASE_URL}/v2/payments/captures/${encodeURIComponent(
        captureId
      )}/refund`,
      payload,
      {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    res.json({
      refundId: response.data.id,
      status: response.data.status,
      raw: response.data,
    });
  } catch (error) {
    const debugId = error.response?.headers?.['paypal-debug-id'];
    console.error('Refund failed', error.response?.data, debugId);
    res.status(error.response?.status || 500).json({
      error: 'REFUND_FAILED',
      debugId,
      details: error.response?.data,
    });
  }
});
```

## Refund response handling

Typical fields include `id` (refund id), `status`, `amount`, and links. Persist refund ids for support and accounting.

```javascript
function summarizeRefund(payload) {
  return {
    refundId: payload.id,
    status: payload.status,
    amount: payload.amount,
  };
}
```

## Common issues

| Issue | Resolution |
|-------|------------|
| `CAPTURE_FULLY_REFUNDED` | No remaining refundable balance |
| Wrong `capture_id` | Use id from capture response, not order id |
| Currency mismatch | Match original capture currency |

## Best practices

- **Validate refund amounts** against your records and remaining capture balance.
- Use **idempotent** business logic (e.g. unique refund request id stored in DB).
- Log **PayPal Debug IDs** for disputes and support.
