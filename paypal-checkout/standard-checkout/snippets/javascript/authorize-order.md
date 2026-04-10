# Authorize and Delay Capture (Server-Side)

For **auth–capture** flows, create the order with `intent: "AUTHORIZE"`, then:

1. **Authorize** (if not already completed by buyer flow): **POST** `/v2/checkout/orders/{id}/authorize`
2. **Capture** the authorization: **POST** `/v2/payments/authorizations/{authorization_id}/capture`
3. **Void** an unused authorization: **POST** `/v2/payments/authorizations/{authorization_id}/void`
4. **Reauthorize** before expiry: **POST** `/v2/payments/authorizations/{authorization_id}/reauthorize`

Base URLs:

- **Sandbox:** `https://api-m.sandbox.paypal.com`
- **Production:** `https://api-m.paypal.com`

## Create order with `AUTHORIZE` intent

```javascript
const payload = {
  intent: 'AUTHORIZE',
  purchase_units: [
    {
      amount: {
        currency_code: 'USD',
        value: '25.00',
      },
    },
  ],
};
// POST ${PAYPAL_BASE_URL}/v2/checkout/orders
```

## Authorize — POST `/v2/checkout/orders/{order_id}/authorize`

```javascript
import axios from 'axios';

const PAYPAL_BASE_URL =
  process.env.PAYPAL_ENVIRONMENT === 'production'
    ? 'https://api-m.paypal.com'
    : 'https://api-m.sandbox.paypal.com';

async function authorizeOrder(accessToken, orderId) {
  const { data } = await axios.post(
    `${PAYPAL_BASE_URL}/v2/checkout/orders/${encodeURIComponent(orderId)}/authorize`,
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

Extract **authorization id**:

```javascript
function getAuthorizationId(orderResponse) {
  return (
    orderResponse?.purchase_units?.[0]?.payments?.authorizations?.[0]?.id ??
    null
  );
}
```

## Capture authorization — POST `/v2/payments/authorizations/{auth_id}/capture`

Supports **partial capture** via `amount` in the body.

```javascript
async function captureAuthorization(accessToken, authorizationId, body = {}) {
  const { data } = await axios.post(
    `${PAYPAL_BASE_URL}/v2/payments/authorizations/${encodeURIComponent(
      authorizationId
    )}/capture`,
    {
      final_capture: body.final_capture !== false,
      amount: body.amount, // optional partial: { currency_code, value }
      ...body.extra,
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

### Partial capture example

```javascript
await captureAuthorization(accessToken, authorizationId, {
  amount: { currency_code: 'USD', value: '10.00' },
  final_capture: false,
});
```

## Void authorization — POST `/v2/payments/authorizations/{auth_id}/void`

```javascript
async function voidAuthorization(accessToken, authorizationId) {
  const { data } = await axios.post(
    `${PAYPAL_BASE_URL}/v2/payments/authorizations/${encodeURIComponent(
      authorizationId
    )}/void`,
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

## Reauthorize — POST `/v2/payments/authorizations/{auth_id}/reauthorize`

```javascript
async function reauthorize(accessToken, authorizationId, amount) {
  const { data } = await axios.post(
    `${PAYPAL_BASE_URL}/v2/payments/authorizations/${encodeURIComponent(
      authorizationId
    )}/reauthorize`,
    {
      amount: {
        currency_code: amount.currency_code,
        value: amount.value,
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

## Express-style routes (illustrative)

```javascript
// POST /paypal-api/checkout/orders/:orderId/authorize
// POST /paypal-api/payments/authorizations/:authorizationId/capture
// POST /paypal-api/payments/authorizations/:authorizationId/void
// POST /paypal-api/payments/authorizations/:authorizationId/reauthorize
```

Wire each to the helpers above; always validate amounts **server-side**.

## Common issues

| Issue | Resolution |
|-------|------------|
| Cannot capture full amount twice | Track remaining authorized amount; use partial captures correctly |
| Authorization expired | Reauthorize within allowed window or create new order |
| Wrong intent | Order must be created with `AUTHORIZE` |

## Best practices

- Store `authorization_id` and capture ids for refunds and reconciliation.
- Log **PayPal Debug IDs** on all failures.
