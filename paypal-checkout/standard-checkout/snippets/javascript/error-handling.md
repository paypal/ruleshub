# Error Handling — Standard Checkout (Server + Client)

Handle PayPal errors consistently: log **PayPal Debug IDs**, retry transient failures carefully, and show **user-friendly** messages in the UI.

## Server-side — try/catch with PayPal Debug IDs

```javascript
import axios from 'axios';

function getDebugId(error) {
  return (
    error.response?.headers?.['paypal-debug-id'] ||
    error.response?.data?.debug_id ||
    null
  );
}

app.post('/paypal-api/checkout/orders/create', async (req, res) => {
  try {
    // ... create order
  } catch (error) {
    const debugId = getDebugId(error);
    console.error('Create order error', {
      message: error.message,
      status: error.response?.status,
      data: error.response?.data,
      paypalDebugId: debugId,
    });
    res.status(error.response?.status || 500).json({
      error: 'ORDER_CREATE_FAILED',
      message: 'We could not start the payment. Please try again.',
      debugId,
    });
  }
});
```

Never expose raw internal messages to clients; keep details in logs.

## Retry with exponential backoff (server)

Use for **429** or **5xx** responses where idempotent:

```javascript
async function axiosPostWithRetry(url, body, config, { retries = 3, baseMs = 300 } = {}) {
  let lastErr;
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      return await axios.post(url, body, config);
    } catch (err) {
      lastErr = err;
      const status = err.response?.status;
      const debugId = err.response?.headers?.['paypal-debug-id'];
      console.warn('PayPal request failed', { status, debugId, attempt });
      if (status && status < 500 && status !== 429) break;
      await new Promise((r) => setTimeout(r, baseMs * 2 ** attempt));
    }
  }
  throw lastErr;
}
```

Only retry **safe** operations or those using **idempotency** keys (`PayPal-Request-Id`).

## Client-side — `onError` and `onCancel` (v5)

```javascript
paypal.Buttons({
  createOrder: () => fetchCreateOrder(),
  onApprove: (data) => fetchCapture(data.orderID),
  onCancel: () => {
    console.info('Buyer cancelled PayPal');
  },
  onError: (err) => {
    console.error(err);
    showUserMessage('Something went wrong with PayPal. Please try again or use another method.');
  },
}).render('#paypal-button-container');
```

## Client-side — v6 patterns

Wrap async flows in `try/catch`; surface generic copy and log details.

```javascript
try {
  await onPayPalWebSdkLoaded();
} catch (e) {
  console.error(e);
  showUserMessage('Payment options could not be loaded. Please refresh.');
}
```

## User-friendly messages

Map known names/codes to short copy; always log the full object + debug id.

```javascript
function mapPayPalErrorToUserMessage(payload) {
  const name = payload?.name || payload?.issue;
  switch (name) {
    case 'INSTRUMENT_DECLINED':
      return 'Your payment was declined. Try another funding source.';
    case 'DUPLICATE_INVOICE_ID':
      return 'This order was already processed.';
    default:
      return 'Something went wrong. Please try again.';
  }
}
```

## Common scenarios

| Scenario | Resolution |
|----------|------------|
| Declined card / funding | Ask buyer to retry or use PayPal balance / another card |
| Session expired | Refresh client token (v6) and recreate session |
| Invalid JSON from your API | Fix server routes; validate `Content-Type` on client |
| Webhook vs capture mismatch | Reconcile with GET order + webhook idempotency |

## Best practices

- Always log **`paypal-debug-id`** when present.
- **Validate amounts server-side** to avoid preventable API errors.
- Rate-limit public endpoints to reduce abuse.
- For production, send structured logs to your observability stack with **no secrets**.
