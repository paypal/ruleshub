# Client Token Generation — Expanded Checkout (JS SDK + Card Fields)

For **JavaScript SDK v6**, the browser needs a **browser-safe client token** from your server. This is the same OAuth pattern as Standard Checkout, but Expanded Checkout **must** also load the **`card-fields`** component when you initialize the SDK (see `sdk-initialization.md`).

Never expose `PAYPAL_CLIENT_SECRET` in frontend code.

## API endpoints

| Environment | OAuth token URL |
|-------------|-----------------|
| Sandbox | `POST https://api-m.sandbox.paypal.com/v1/oauth2/token` |
| Production | `POST https://api-m.paypal.com/v1/oauth2/token` |

**Body** (URL-encoded):

```
grant_type=client_credentials&response_type=client_token&intent=sdk_init
```

**Authorization:** `Basic base64(PAYPAL_CLIENT_ID:PAYPAL_CLIENT_SECRET)`

### Your backend (browser-safe token)

| Method | Suggested path |
|--------|----------------|
| GET | `/paypal-api/auth/browser-safe-client-token` |

Returns JSON the client uses as `clientToken` (or `accessToken` depending on your wrapper) for `createInstance`.

## Express — GET `/paypal-api/auth/browser-safe-client-token`

```javascript
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

## Card Fields component requirement

After the client receives the token, initialize the SDK with **both** PayPal payments and card fields:

- **v6:** `components: ["paypal-payments", "card-fields"]`
- **v5:** load script with `components=buttons,card-fields`

Without `card-fields`, Expanded Checkout card UI will not be available.

## Caching

- Cache until shortly before `expires_in` (e.g. 1–2 minute buffer).
- For multiple server instances, use Redis or similar — not only in-memory cache.

## Common issues

| Issue | Cause | Fix |
|-------|--------|-----|
| `invalid_client` | Wrong credentials or sandbox/live mismatch | Align dashboard app and env vars |
| Token expired during checkout | No refresh | Refresh before expiry; handle 401 on SDK retriable flows |
| Card Fields missing | Token OK but wrong SDK config | Add `card-fields` to components (v5/v6) |

## Best practices

- Rate-limit the token endpoint if exposed publicly.
- Log `paypal-debug-id` on failures.
- Use HTTPS for every hop in production.
