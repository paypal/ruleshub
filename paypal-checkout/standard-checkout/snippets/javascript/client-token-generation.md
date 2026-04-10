# Client Token Generation (Server-Side, Browser-Safe) — JS SDK v6

For **JavaScript SDK v6**, the browser needs a **browser-safe client token** from your server. Do not expose `PAYPAL_CLIENT_SECRET` in frontend code.

## OAuth endpoint

**POST** `https://api-m.sandbox.paypal.com/v1/oauth2/token` (sandbox)  
**POST** `https://api-m.paypal.com/v1/oauth2/token` (production)

Body (form URL-encoded):

```
grant_type=client_credentials&response_type=client_token&intent=sdk_init
```

Use **Basic** auth: `Authorization: Basic base64(client_id:client_secret)`.

## Express.js — GET `/paypal-api/auth/browser-safe-client-token`

```javascript
// server.js
import express from 'express';
import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

const app = express();

const PAYPAL_CLIENT_ID = process.env.PAYPAL_CLIENT_ID;
const PAYPAL_CLIENT_SECRET = process.env.PAYPAL_CLIENT_SECRET;
const PAYPAL_BASE_URL =
  process.env.PAYPAL_ENVIRONMENT === 'production'
    ? 'https://api-m.paypal.com'
    : 'https://api-m.sandbox.paypal.com';

let cachedToken = null;
let tokenExpirationMs = null;

app.get('/paypal-api/auth/browser-safe-client-token', async (req, res) => {
  try {
    if (cachedToken && tokenExpirationMs && Date.now() < tokenExpirationMs) {
      return res.json({
        accessToken: cachedToken,
        expiresIn: Math.floor((tokenExpirationMs - Date.now()) / 1000),
      });
    }

    const auth = Buffer.from(`${PAYPAL_CLIENT_ID}:${PAYPAL_CLIENT_SECRET}`).toString(
      'base64'
    );

    const response = await axios.post(
      `${PAYPAL_BASE_URL}/v1/oauth2/token`,
      'grant_type=client_credentials&response_type=client_token&intent=sdk_init',
      {
        headers: {
          Authorization: `Basic ${auth}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      }
    );

    const { access_token, expires_in } = response.data;
    const bufferSec = 120;
    cachedToken = access_token;
    tokenExpirationMs = Date.now() + Math.max(0, (expires_in - bufferSec) * 1000);

    res.json({
      accessToken: access_token,
      expiresIn: expires_in,
    });
  } catch (error) {
    const debugId = error.response?.headers?.['paypal-debug-id'];
    console.error('Client token error:', {
      message: error.message,
      data: error.response?.data,
      paypalDebugId: debugId,
    });
    res.status(error.response?.status || 500).json({
      error: 'TOKEN_GENERATION_FAILED',
      message: 'Failed to generate client token',
      debugId,
    });
  }
});
```

## Token caching with expiration

- Cache the token in memory (or Redis for multi-instance) until shortly before `expires_in`.
- Refresh **before** expiry (e.g. 1–2 minute buffer) to avoid race conditions during `createInstance`.

## Error handling and PayPal Debug IDs

Always log **`paypal-debug-id`** (response header on errors) when contacting PayPal support.

```javascript
function logPayPalAxiosError(error, label) {
  const debugId = error.response?.headers?.['paypal-debug-id'];
  console.error(label, {
    status: error.response?.status,
    data: error.response?.data,
    paypalDebugId: debugId,
  });
}
```

## Native `fetch` variant

```javascript
async function fetchBrowserSafeClientTokenFromPayPal() {
  const PAYPAL_BASE_URL =
    process.env.PAYPAL_ENVIRONMENT === 'production'
      ? 'https://api-m.paypal.com'
      : 'https://api-m.sandbox.paypal.com';

  const auth = Buffer.from(
    `${process.env.PAYPAL_CLIENT_ID}:${process.env.PAYPAL_CLIENT_SECRET}`
  ).toString('base64');

  const res = await fetch(`${PAYPAL_BASE_URL}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${auth}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials&response_type=client_token&intent=sdk_init',
  });

  if (!res.ok) {
    const debugId = res.headers.get('paypal-debug-id');
    const body = await res.text();
    throw new Error(`Token failed ${res.status} debug=${debugId} body=${body}`);
  }

  return res.json();
}
```

## Common issues

| Issue | Cause | Fix |
|-------|--------|-----|
| `invalid_client` | Wrong id/secret or wrong environment | Match dashboard (sandbox vs live) and env vars |
| HTML instead of JSON on `/paypal-api/...` | Dev server fallback to `index.html` | Fix route order and API path |
| Token works once then fails | Clock skew or no refresh | Sync NTP; refresh before expiry |

## Best practices

- Return only the **browser-safe** token to the client — never the client secret.
- Rate-limit this endpoint if exposed publicly.
- Use HTTPS for every hop in production.
