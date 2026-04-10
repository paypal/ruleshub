# Get Order Details (Server-Side)

Retrieve an order with:

**GET** `/v2/checkout/orders/{order_id}`

- **Sandbox:** `https://api-m.sandbox.paypal.com/v2/checkout/orders/{order_id}`
- **Production:** `https://api-m.paypal.com/v2/checkout/orders/{order_id}`

Use for reconciliation, support, and verifying status before capture or fulfillment.

## Express — GET `/paypal-api/checkout/orders/:orderId`

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

app.get('/paypal-api/checkout/orders/:orderId', async (req, res) => {
  const { orderId } = req.params;

  try {
    const accessToken = await getPayPalAccessToken();

    const response = await axios.get(
      `${PAYPAL_BASE_URL}/v2/checkout/orders/${encodeURIComponent(orderId)}`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      }
    );

    res.json(response.data);
  } catch (error) {
    const debugId = error.response?.headers?.['paypal-debug-id'];
    console.error('Get order failed', error.response?.data, debugId);
    res.status(error.response?.status || 500).json({
      error: 'GET_ORDER_FAILED',
      debugId,
    });
  }
});
```

## Response fields (typical)

| Field | Meaning |
|-------|---------|
| `id` | PayPal order id |
| `status` | e.g. `CREATED`, `APPROVED`, `COMPLETED` |
| `intent` | `CAPTURE` or `AUTHORIZE` |
| `purchase_units[]` | Amounts, items, shipping |
| `purchase_units[].payments` | Authorizations/captures when present |
| `payer` | Payer info when available |

Always treat the API response as **source of truth** for PayPal-side state.

## Common issues

| Issue | Resolution |
|-------|------------|
| 404 | Wrong environment (sandbox order on live host or vice versa) |
| `RESOURCE_NOT_FOUND` | Typo in order id or expired/old id |

## Best practices

- Cache minimally; order status can change—refresh before critical actions.
- Log **PayPal Debug IDs** on errors.
