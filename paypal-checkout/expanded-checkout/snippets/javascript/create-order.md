# Create Order — Expanded Checkout (Card + PayPal `payment_source`)

Create orders with **POST** `/v2/checkout/orders`.

| Environment | URL |
|-------------|-----|
| Sandbox | `https://api-m.sandbox.paypal.com/v2/checkout/orders` |
| Production | `https://api-m.paypal.com/v2/checkout/orders` |

Use **Bearer** access token from `grant_type=client_credentials` (server-side).

**Important:** Use **`payment_source.paypal.experience_context`** for PayPal wallet flows — **not** deprecated top-level `application_context`. Use **`payment_source.card`** for card payments, including 3DS attributes.

## OAuth access token (server)

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

## Card payment — `payment_source.card` + 3DS (`SCA_WHEN_REQUIRED`)

```javascript
import crypto from 'node:crypto';

function buildCardOrderBody({ currencyCode, value, returnUrl, cancelUrl }) {
  return {
    intent: 'CAPTURE',
    purchase_units: [
      {
        amount: {
          currency_code: currencyCode,
          value: Number(value).toFixed(2),
        },
      },
    ],
    payment_source: {
      card: {
        attributes: {
          verification: {
            method: 'SCA_WHEN_REQUIRED', // 3DS when required by issuer/regulation
          },
        },
      },
    },
  };
}
```

For **always** challenge SCA when supported (stricter; may increase friction):

```javascript
verification: { method: 'SCA_ALWAYS' }
```

## PayPal wallet — `payment_source.paypal.experience_context`

```javascript
function buildPayPalWalletOrderBody({ currencyCode, value, brandName, returnUrl, cancelUrl }) {
  return {
    intent: 'CAPTURE',
    purchase_units: [
      {
        amount: {
          currency_code: currencyCode,
          value: Number(value).toFixed(2),
        },
      },
    ],
    payment_source: {
      paypal: {
        experience_context: {
          payment_method_preference: 'IMMEDIATE_PAYMENT_REQUIRED',
          brand_name: brandName || 'My Store',
          locale: 'en-US',
          landing_page: 'LOGIN',
          user_action: 'PAY_NOW',
          return_url: returnUrl,
          cancel_url: cancelUrl,
        },
      },
    },
  };
}
```

Do **not** use legacy `application_context` for new integrations — use `experience_context` under `payment_source.paypal`.

## Express — POST `/paypal-api/checkout/orders/create`

```javascript
app.post('/paypal-api/checkout/orders/create', async (req, res) => {
  try {
    const {
      amount,
      currencyCode = 'USD',
      paymentMethod = 'paypal', // 'paypal' | 'card'
      returnUrl,
      cancelUrl,
    } = req.body;

    const value = parseFloat(amount);
    if (!Number.isFinite(value) || value <= 0) {
      return res.status(400).json({ error: 'INVALID_AMOUNT' });
    }

    const accessToken = await getPayPalAccessToken();

    let body;
    if (paymentMethod === 'card') {
      body = buildCardOrderBody({
        currencyCode,
        value,
        returnUrl,
        cancelUrl,
      });
    } else {
      body = buildPayPalWalletOrderBody({
        currencyCode,
        value,
        brandName: process.env.STORE_BRAND_NAME,
        returnUrl: returnUrl || `${process.env.PUBLIC_BASE_URL}/paypal/return`,
        cancelUrl: cancelUrl || `${process.env.PUBLIC_BASE_URL}/paypal/cancel`,
      });
    }

    const response = await axios.post(`${PAYPAL_BASE_URL}/v2/checkout/orders`, body, {
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
        'PayPal-Request-Id': crypto.randomUUID(),
      },
    });

    res.json({ id: response.data.id, status: response.data.status });
  } catch (error) {
    const debugId = error.response?.headers?.['paypal-debug-id'];
    console.error('create order', error.response?.data || error.message, debugId);
    res.status(error.response?.status || 500).json({
      error: 'CREATE_ORDER_FAILED',
      details: error.response?.data,
      debugId,
    });
  }
});
```

## Amount validation and idempotency

- Recompute totals on the server; do not trust client-only amounts.
- Send **`PayPal-Request-Id`** (UUID) per logical create attempt for idempotent retries.

## Common issues

| Issue | Resolution |
|-------|------------|
| `UNPROCESSABLE_ENTITY` on card | Verify `payment_source.card` shape and currency. |
| Wrong redirect for PayPal | Ensure `return_url` / `cancel_url` are HTTPS and whitelisted if required. |
| Deprecated field warnings | Remove `application_context`; use `payment_source.paypal.experience_context`. |

## Best practices

- Single source of truth for **currency** and **minor units** (2 decimals for USD).
- Log **debug IDs** on failure.
- Match **intent** (`CAPTURE` vs `AUTHORIZE`) to your fulfillment and webhooks.
