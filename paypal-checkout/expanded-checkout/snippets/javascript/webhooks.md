# Webhooks — Expanded Checkout (Card + Vault + Authorization)

Webhook verification matches **Standard Checkout**: POST raw body to **`/v1/notifications/verify-webhook-signature`**. Expanded Checkout adds relevance for **card captures**, **vault tokens**, and **authorize** flows.

## API endpoint

| Method | URL |
|--------|-----|
| POST | `https://api-m.sandbox.paypal.com/v1/notifications/verify-webhook-signature` |
| POST | `https://api-m.paypal.com/v1/notifications/verify-webhook-signature` |

Use **OAuth** `grant_type=client_credentials` for the Bearer token.

## Express — raw body + verification

```javascript
import express from 'express';
import axios from 'axios';

const PAYPAL_BASE_URL =
  process.env.PAYPAL_ENVIRONMENT === 'production'
    ? 'https://api-m.paypal.com'
    : 'https://api-m.sandbox.paypal.com';

const app = express();

app.post(
  '/paypal-api/webhooks',
  express.raw({ type: 'application/json' }),
  async (req, res) => {
    const webhookId = process.env.PAYPAL_WEBHOOK_ID;
    const bodyString = req.body.toString('utf8');

    try {
      const accessToken = await getPayPalAccessToken();

      const verifyPayload = {
        auth_algo: req.headers['paypal-auth-algo'],
        cert_url: req.headers['paypal-cert-url'],
        transmission_id: req.headers['paypal-transmission-id'],
        transmission_sig: req.headers['paypal-transmission-sig'],
        transmission_time: req.headers['paypal-transmission-time'],
        webhook_id: webhookId,
        webhook_event: JSON.parse(bodyString),
      };

      const { data } = await axios.post(
        `${PAYPAL_BASE_URL}/v1/notifications/verify-webhook-signature`,
        verifyPayload,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (data.verification_status !== 'SUCCESS') {
        return res.sendStatus(400);
      }

      const event = JSON.parse(bodyString);
      await dispatchWebhook(event);

      res.sendStatus(200);
    } catch (error) {
      console.error('webhook error', error.response?.data || error.message);
      res.sendStatus(500);
    }
  }
);
```

Register this route **before** `express.json()` global middleware, or mount webhooks on a separate app so JSON parser does not consume the body.

## Dispatch — card, vault, authorization

```javascript
async function dispatchWebhook(event) {
  const type = event.event_type;

  switch (type) {
    case 'PAYMENT.CAPTURE.COMPLETED':
      await onPaymentCaptureCompleted(event.resource);
      break;
    case 'PAYMENT.CAPTURE.DENIED':
      await onPaymentCaptureDenied(event.resource);
      break;
    case 'VAULT.PAYMENT-TOKEN.CREATED':
      await onVaultPaymentTokenCreated(event.resource);
      break;
    case 'VAULT.PAYMENT-TOKEN.DELETED':
      await onVaultPaymentTokenDeleted(event.resource);
      break;
    case 'PAYMENT.AUTHORIZATION.CREATED':
    case 'PAYMENT.AUTHORIZATION.VOIDED':
      await onAuthorizationEvent(type, event.resource);
      break;
    default:
      console.log('Unhandled webhook', type);
  }
}
```

## `PAYMENT.CAPTURE.COMPLETED`

- Confirms funds captured — good for **fulfillment** if you use async capture.
- Cross-check **amount**, **custom_id**, **invoice_id** with your order store.

```javascript
async function onPaymentCaptureCompleted(resource) {
  const captureId = resource?.id;
  const amount = resource?.amount;
  const customId = resource?.custom_id;
  // Mark order paid, idempotent by captureId
}
```

## `PAYMENT.CAPTURE.DENIED`

- Card or risk decline after capture attempt — **do not fulfill**.
- Align with client error handling (`error-handling.md`).

## Vault events

### `VAULT.PAYMENT-TOKEN.CREATED`

- Persist **token id** to customer profile (encrypted).
- Do not log sensitive card data.

### `VAULT.PAYMENT-TOKEN.DELETED`

- Remove or disable stored token in your DB.

## Authorization events (`AUTHORIZE` intent)

If you use **authorize** then **capture later**:

| Event | Use |
|-------|-----|
| `PAYMENT.AUTHORIZATION.CREATED` | Hold placed — ship when business rules allow |
| `PAYMENT.AUTHORIZATION.VOIDED` | Release hold — cancel order |

```javascript
async function onAuthorizationEvent(type, resource) {
  const authId = resource?.id;
  if (type === 'PAYMENT.AUTHORIZATION.CREATED') {
    // store authorization id for later capture
  }
  if (type === 'PAYMENT.AUTHORIZATION.VOIDED') {
    // mark order cancelled
  }
}
```

## Common issues

| Issue | Resolution |
|-------|------------|
| Verification always fails | Wrong `PAYPAL_WEBHOOK_ID`; body altered by middleware — use raw parser. |
| Duplicate events | Use **event id** + DB unique constraint for idempotency. |
| Missing card context | Some events are wallet-agnostic — use **GET order** / **GET capture** for details. |

## Best practices

- Respond **200** quickly; queue heavy work asynchronously.
- Store **raw event** (short TTL) for audits.
- Reconcile webhooks with **GET** APIs before shipping high-value goods.
