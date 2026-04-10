# Webhooks — Braintree + PayPal

Verify signatures **before** acting on payloads. Respond **200** quickly and process asynchronously for heavy work.

## Braintree — parse and handle

### Express route

```javascript
import express from 'express';
import { createBraintreeGateway } from './braintree-gateway.js';

const gateway = createBraintreeGateway();
const router = express.Router();

router.post(
  '/webhooks/braintree',
  express.raw({ type: 'application/json' }),
  (req, res) => {
    const btSignature = req.headers['bt-signature'];
    const btPayload = req.body.toString();

    let webhookNotification;
    try {
      webhookNotification = gateway.webhookNotification.parse(btSignature, btPayload);
    } catch (err) {
      console.error('Invalid Braintree webhook signature', err);
      return res.sendStatus(400);
    }

    const kind = webhookNotification.kind;
    const subject = webhookNotification.subject;

    switch (kind) {
      case 'transaction_settled': // TRANSACTION_SETTLED
        // subject.transaction
        break;
      case 'transaction_settlement_declined':
        break;
      case 'dispute_opened': // DISPUTE_OPENED
        // subject.dispute
        break;
      case 'dispute_lost':
      case 'dispute_won':
        break;
      case 'subscription_charged_successfully':
      case 'subscription_charged_unsuccessfully':
      case 'subscription_canceled':
      case 'subscription_expired':
      case 'subscription_trial_ended':
        // subject.subscription — see Braintree subscription webhook reference
        break;
      default:
        console.log('Unhandled Braintree webhook kind', kind);
    }

    res.sendStatus(200);
  }
);

export default router;
```

### Common `kind` values (documentation vs API)

Braintree webhook **`kind`** strings in notifications are **lowercase snake_case**. Docs often show enums like **`TRANSACTION_SETTLED`**, **`DISPUTE_OPENED`**, **`SUBSCRIPTION_*`** — map them to the parsed **`kind`** below.

| Doc-style name | Parsed `kind` (examples) |
|----------------|---------------------------|
| `TRANSACTION_SETTLED` | `transaction_settled` |
| `DISPUTE_OPENED` | `dispute_opened` |
| `SUBSCRIPTION_CHARGED_SUCCESSFULLY` | `subscription_charged_successfully` |
| `SUBSCRIPTION_CHARGED_UNSUCCESSFULLY` | `subscription_charged_unsuccessfully` |
| Other `SUBSCRIPTION_*` | `subscription_canceled`, `subscription_expired`, `subscription_trial_ended`, etc. |

Also common: **`transaction_settlement_declined`**, **`dispute_lost`**, **`dispute_won`**.

Configure the webhook URL and **shared secret** in the Braintree Control Panel so **`bt-signature`** validates.

## PayPal — verify signature

### `POST /v1/notifications/verify-webhook-signature`

```javascript
import express from 'express';
import axios from 'axios';
import { getPayPalAccessToken } from './paypal-auth.js';

const PAYPAL_BASE =
  process.env.PAYPAL_ENVIRONMENT === 'production'
    ? 'https://api-m.paypal.com'
    : 'https://api-m.sandbox.paypal.com';

const router = express.Router();

router.post('/webhooks/paypal', express.json(), async (req, res) => {
  const accessToken = await getPayPalAccessToken();

  const verification = {
    auth_algo: req.headers['paypal-auth-algo'],
    cert_url: req.headers['paypal-cert-url'],
    transmission_id: req.headers['paypal-transmission-id'],
    transmission_sig: req.headers['paypal-transmission-sig'],
    transmission_time: req.headers['paypal-transmission-time'],
    webhook_id: process.env.PAYPAL_WEBHOOK_ID,
    webhook_event: req.body,
  };

  try {
    const { data } = await axios.post(
      `${PAYPAL_BASE}/v1/notifications/verify-webhook-signature`,
      verification,
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
  } catch (e) {
    console.error('Webhook verify failed', e.response?.data || e.message);
    return res.sendStatus(500);
  }

  const eventType = req.body.event_type;
  switch (eventType) {
    case 'PAYMENT.CAPTURE.COMPLETED':
      break;
    case 'PAYMENT.CAPTURE.DENIED':
    case 'PAYMENT.CAPTURE.REFUNDED':
      break;
    case 'MERCHANT.ONBOARDING.COMPLETED':
      break;
    case 'CUSTOMER.MERCHANT-INTEGRATION.SELLER-ONBOARDING.STARTED':
    case 'CUSTOMER.MERCHANT-INTEGRATION.SELLER-ONBOARDING.COMPLETED':
      break;
    default:
      console.log('Unhandled PayPal event', eventType);
  }

  res.sendStatus(200);
});

export default router;
```

### Common `event_type` values (examples)

- **`PAYMENT.CAPTURE.COMPLETED`**, **`PAYMENT.CAPTURE.DENIED`**, **`PAYMENT.CAPTURE.REFUNDED`**
- **`MERCHANT.ONBOARDING.COMPLETED`**
- Seller onboarding variants under **`CUSTOMER.MERCHANT-INTEGRATION.*`**

Store **`PAYPAL_WEBHOOK_ID`** from the developer dashboard for verification. Log **`paypal-debug-id`** on failures.
