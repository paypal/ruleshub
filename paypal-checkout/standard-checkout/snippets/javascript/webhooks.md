# Webhooks — Standard Checkout (Express.js)

Listen for PayPal events (e.g. **`PAYMENT.CAPTURE.COMPLETED`**, **`CHECKOUT.ORDER.APPROVED`**) on a **dedicated HTTPS endpoint**. **Verify** each notification using **POST** `/v1/notifications/verify-webhook-signature`.

Base URLs:

- **Sandbox:** `https://api-m.sandbox.paypal.com`
- **Production:** `https://api-m.paypal.com`

## Register the webhook URL

Create a webhook in the [Developer Dashboard](https://developer.paypal.com/dashboard/) pointing to:

`https://your-domain.com/paypal-api/webhooks`

Store **`PAYPAL_WEBHOOK_ID`** in environment variables.

## Express — raw body for verification

Verification needs the **exact** JSON body string PayPal sent. Use `express.raw` for the webhook route **only**:

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
    const bodyString = req.body.toString('utf8');
    let webhookEvent;

    try {
      webhookEvent = JSON.parse(bodyString);
    } catch {
      return res.sendStatus(400);
    }

    const headers = req.headers;
    const verified = await verifyWebhookSignature(headers, webhookEvent, bodyString);

    if (!verified) {
      console.error('Webhook signature verification failed');
      return res.sendStatus(400);
    }

    try {
      await handleWebhookEvent(webhookEvent);
    } catch (e) {
      console.error('Webhook handler error', e);
      return res.sendStatus(500);
    }

    res.sendStatus(200);
  }
);
```

## Verify signature — POST `/v1/notifications/verify-webhook-signature`

```javascript
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

async function verifyWebhookSignature(headers, webhookEvent, bodyString) {
  const accessToken = await getPayPalAccessToken();

  const verification = {
    auth_algo: headers['paypal-auth-algo'],
    cert_url: headers['paypal-cert-url'],
    transmission_id: headers['paypal-transmission-id'],
    transmission_sig: headers['paypal-transmission-sig'],
    transmission_time: headers['paypal-transmission-time'],
    webhook_id: process.env.PAYPAL_WEBHOOK_ID,
    webhook_event: webhookEvent,
  };

  const { data } = await axios.post(
    `${PAYPAL_BASE_URL}/v1/notifications/verify-webhook-signature`,
    verification,
    {
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
    }
  );

  return data.verification_status === 'SUCCESS';
}
```

Some integrations pass `webhook_event` as the parsed object (as above); if verification fails, confirm against the latest API docs for your account type.

## Handle events

```javascript
const processedEventIds = new Set(); // use Redis/DB in production

async function handleWebhookEvent(event) {
  const eventId = event.id;
  if (processedEventIds.has(eventId)) {
    return;
  }

  switch (event.event_type) {
    case 'PAYMENT.CAPTURE.COMPLETED': {
      const capture = event.resource;
      console.log('Capture completed', capture.id, capture.amount);
      // Fulfill order idempotently
      break;
    }
    case 'CHECKOUT.ORDER.APPROVED': {
      console.log('Order approved', event.resource?.id);
      break;
    }
    default:
      console.log('Unhandled event', event.event_type);
  }

  processedEventIds.add(eventId);
}
```

## Idempotent processing

- Store **`event.id`** after successful handling; ignore duplicates.
- Use DB **transactions** so fulfillment + mark-processed are atomic.

## Common issues

| Issue | Resolution |
|-------|------------|
| Verification always fails | Wrong `webhook_id`; body altered by middleware; use raw body |
| 404 on URL | Public HTTPS required; path must match dashboard |
| Double fulfillment | Implement idempotency with stored event ids |

## Best practices

- Respond **200** quickly after enqueueing work, or process fast enough to avoid retries storm.
- Log **PayPal Debug IDs** from related REST calls when correlating.
- Reconcile webhooks with **GET order** for critical flows.
