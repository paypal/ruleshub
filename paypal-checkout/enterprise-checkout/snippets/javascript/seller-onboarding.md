# Seller onboarding — Partner Referrals + merchant integration status

Use **`POST /v2/customer/partner-referrals`** to send a seller through PayPal onboarding. Read **`action_url`** from the response and redirect the seller. After onboarding, poll **`GET /v1/customer/partners/{partner_id}/merchant-integrations/{merchant_id}`** and verify **`payments_receivable`** before live captures.

REST bases:

| Environment | Base URL |
|-------------|----------|
| Sandbox | `https://api-m.sandbox.paypal.com` |
| Production | `https://api-m.paypal.com` |

## OAuth (client credentials)

```javascript
// server/paypal-auth.js
import axios from 'axios';

const PAYPAL_BASE =
  process.env.PAYPAL_ENVIRONMENT === 'production'
    ? 'https://api-m.paypal.com'
    : 'https://api-m.sandbox.paypal.com';

let cachedToken = { value: null, expiresAt: 0 };

export async function getPayPalAccessToken() {
  const now = Date.now();
  if (cachedToken.value && cachedToken.expiresAt > now + 60_000) {
    return cachedToken.value;
  }

  const auth = Buffer.from(
    `${process.env.PAYPAL_CLIENT_ID}:${process.env.PAYPAL_CLIENT_SECRET}`
  ).toString('base64');

  const { data } = await axios.post(
    `${PAYPAL_BASE}/v1/oauth2/token`,
    new URLSearchParams({ grant_type: 'client_credentials' }),
    {
      headers: {
        Authorization: `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    }
  );

  cachedToken = {
    value: data.access_token,
    expiresAt: now + (data.expires_in ?? 3600) * 1000,
  };
  return cachedToken.value;
}
```

## POST `/v2/customer/partner-referrals`

Body includes **`tracking_id`**, **`operations`** (API integration / third party), **`products`**, and **`legal_consents`**. Resolve the seller **`action_url`** from **`links`** where **`rel`** is **`action_url`**.

```javascript
import axios from 'axios';
import { getPayPalAccessToken } from './paypal-auth.js';

const PAYPAL_BASE =
  process.env.PAYPAL_ENVIRONMENT === 'production'
    ? 'https://api-m.paypal.com'
    : 'https://api-m.sandbox.paypal.com';

/**
 * @param {object} opts
 * @param {string} opts.trackingId - Unique per seller attempt (correlate webhooks + support)
 * @param {string} opts.returnUrl - Where PayPal returns the seller after onboarding
 */
export async function createPartnerReferral({ trackingId, returnUrl }) {
  const accessToken = await getPayPalAccessToken();

  const body = {
    tracking_id: trackingId,
    partner_config_override: {
      return_url: returnUrl,
    },
    operations: [
      {
        operation: 'API_INTEGRATION',
        api_integration_preference: {
          rest_api_integration: {
            integration_method: 'PAYPAL',
            integration_type: 'THIRD_PARTY',
            third_party_details: {
              features: ['PAYMENT', 'REFUND', 'PARTNER_FEE'],
            },
          },
        },
      },
    ],
    products: ['EXPRESS_CHECKOUT'],
    legal_consents: [{ type: 'SHARE_DATA_CONSENT', granted: true }],
  };

  const { data } = await axios.post(
    `${PAYPAL_BASE}/v2/customer/partner-referrals`,
    body,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    }
  );

  const actionUrl = data.links?.find((l) => l.rel === 'action_url')?.href;
  return { raw: data, actionUrl };
}
```

Express route example:

```javascript
import { Router } from 'express';
import { createPartnerReferral } from './partner-referrals.js';

const router = Router();

router.post('/api/paypal/partner-referrals', async (req, res) => {
  try {
    const trackingId = req.body.trackingId ?? crypto.randomUUID();
    const { actionUrl, raw } = await createPartnerReferral({
      trackingId,
      returnUrl: req.body.returnUrl ?? 'https://yourplatform.com/onboarding/return',
    });
    if (!actionUrl) {
      return res.status(502).json({ error: 'No action_url in partner-referrals response' });
    }
    res.json({ trackingId, actionUrl, referral: raw });
  } catch (err) {
    console.error(err.response?.data ?? err);
    res.status(500).json({ error: 'Partner referral failed' });
  }
});

export default router;
```

## Check status: GET `/v1/customer/partners/{partner_id}/merchant-integrations/{merchant_id}`

Use your platform **`partner_id`** (same concept as **`PAYPAL_PARTNER_MERCHANT_ID`** / partner merchant id in dashboard) and the **connected seller’s** **`merchant_id`** after they complete onboarding.

```javascript
export async function getMerchantIntegrationStatus(partnerId, merchantId) {
  const accessToken = await getPayPalAccessToken();

  const { data } = await axios.get(
    `${PAYPAL_BASE}/v1/customer/partners/${encodeURIComponent(partnerId)}/merchant-integrations/${encodeURIComponent(merchantId)}`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  );

  return data;
}
```

### Verify before captures

- **`payments_receivable`** — must be **`true`** to accept payments for that seller.
- Also confirm **`primary_email_confirmed`** and **`oauth_integrations`** per your compliance checklist.

```javascript
const status = await getMerchantIntegrationStatus(
  process.env.PAYPAL_PARTNER_MERCHANT_ID,
  sellerMerchantId
);

if (!status.payments_receivable) {
  // Block checkout or show seller "finish onboarding"
}
```

## Notes

- Store **`tracking_id`** and returned seller **`merchant_id`** securely; **`merchant_id`** feeds **`PayPal-Auth-Assertion`** (`payer_id`) on multiparty orders (`multiparty-create-order.md`).
- Subscribe to webhook events such as **`MERCHANT.ONBOARDING.COMPLETED`** (`webhooks.md`) to update your database when onboarding finishes.
