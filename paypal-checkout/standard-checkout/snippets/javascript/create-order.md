# Create Order (Server-Side) — Orders API v2

Create orders with **POST** `/v2/checkout/orders`.

- **Sandbox:** `https://api-m.sandbox.paypal.com/v2/checkout/orders`
- **Production:** `https://api-m.paypal.com/v2/checkout/orders`

Use a **Bearer** access token from `grant_type=client_credentials` (not the browser-safe client token).

## Shared: OAuth access token

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

## Express — POST `/paypal-api/checkout/orders/create`

```javascript
import express from 'express';
import crypto from 'node:crypto';
import axios from 'axios';

const app = express();
app.use(express.json());

app.post('/paypal-api/checkout/orders/create', async (req, res) => {
  try {
    const {
      amount,
      currency = 'USD',
      items = [],
      shipping_amount,
      description,
      custom_id,
      invoice_id,
    } = req.body;

    const value = parseFloat(amount);
    if (!Number.isFinite(value) || value <= 0) {
      return res.status(400).json({ error: 'INVALID_AMOUNT' });
    }

    const accessToken = await getPayPalAccessToken();

    const purchaseUnit = {
      amount: {
        currency_code: currency,
        value: value.toFixed(2),
      },
      description: description || 'Order',
      custom_id,
      invoice_id,
    };

    if (items.length > 0) {
      const itemTotal = items.reduce(
        (sum, it) => sum + parseFloat(it.price) * parseInt(it.quantity || '1', 10),
        0
      );
      purchaseUnit.amount.breakdown = {
        item_total: {
          currency_code: currency,
          value: itemTotal.toFixed(2),
        },
      };
      if (shipping_amount != null) {
        purchaseUnit.amount.breakdown.shipping = {
          currency_code: currency,
          value: parseFloat(shipping_amount).toFixed(2),
        };
      }
      purchaseUnit.items = items.map((it) => ({
        name: it.name,
        quantity: String(it.quantity || 1),
        unit_amount: {
          currency_code: currency,
          value: parseFloat(it.price).toFixed(2),
        },
        sku: it.sku,
      }));
    }

    const payload = {
      intent: 'CAPTURE',
      purchase_units: [purchaseUnit],
    };

    const response = await axios.post(
      `${PAYPAL_BASE_URL}/v2/checkout/orders`,
      payload,
      {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
          'PayPal-Request-Id': crypto.randomUUID(),
        },
      }
    );

    res.json({
      id: response.data.id,
      status: response.data.status,
      links: response.data.links,
    });
  } catch (error) {
    const debugId = error.response?.headers?.['paypal-debug-id'];
    console.error('Create order failed', error.response?.data, debugId);
    res.status(error.response?.status || 500).json({
      error: 'ORDER_CREATE_FAILED',
      debugId,
      details: error.response?.data?.details,
    });
  }
});
```

## Example payloads

### Basic

```json
{
  "intent": "CAPTURE",
  "purchase_units": [
    {
      "amount": {
        "currency_code": "USD",
        "value": "10.00"
      }
    }
  ]
}
```

### With line items

Ensure **item totals** match `purchase_units[0].amount` when using `breakdown`.

### With shipping (fixed shipping in breakdown)

```json
{
  "intent": "CAPTURE",
  "purchase_units": [
    {
      "amount": {
        "currency_code": "USD",
        "value": "35.00",
        "breakdown": {
          "item_total": { "currency_code": "USD", "value": "30.00" },
          "shipping": { "currency_code": "USD", "value": "5.00" }
        }
      },
      "items": [
        {
          "name": "Widget",
          "quantity": "1",
          "unit_amount": { "currency_code": "USD", "value": "30.00" }
        }
      ],
      "shipping": {
        "name": { "full_name": "Jane Buyer" },
        "address": {
          "address_line_1": "1 Main St",
          "admin_area_2": "San Jose",
          "admin_area_1": "CA",
          "postal_code": "95112",
          "country_code": "US"
        }
      }
    }
  ],
  "payment_source": {
    "paypal": {
      "experience_context": {
        "shipping_preference": "SET_PROVIDED_ADDRESS"
      }
    }
  }
}
```

Adjust fields to match [Orders API v2](https://developer.paypal.com/docs/api/orders/v2/) when using PayPal-provided shipping vs merchant-provided address.

## Idempotency — `PayPal-Request-Id`

Send a unique `PayPal-Request-Id` per logical create attempt so safe retries do not double-charge business logic on PayPal’s side.

```javascript
'PayPal-Request-Id': idempotencyKey || crypto.randomUUID(),
```

## Client usage (v6)

Your page should call **only your server**; the server validates the amount and creates the order.

```javascript
const res = await fetch('/paypal-api/checkout/orders/create', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    amount: '49.99',
    currency: 'USD',
    items: [{ name: 'Tee', quantity: '1', price: '49.99' }],
  }),
});
const { id: orderId } = await res.json();
// Pass orderId into PayPal One-Time Payment session / approval flow
```

## Common issues

| Issue | Fix |
|-------|-----|
| `INVALID_REQUEST` breakdown | Totals must match; include all breakdown components you reference |
| Wrong currency | Use ISO currency codes supported for your account |
| Duplicate orders on retry | Use stable `PayPal-Request-Id` per user action |

## Best practices

- **Validate amounts server-side** against your cart database.
- Log **PayPal Debug IDs** on failure.
- Store `orderId` with your internal order id for reconciliation.
