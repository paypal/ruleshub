#### Generate Client Token for v6 SDK

```javascript
const express = require('express');
const fetch = require('node-fetch');

const app = express();
app.use(express.json());

const PAYPAL_BASE = process.env.PAYPAL_BASE || 'https://api-m.sandbox.paypal.com';
const CLIENT_ID = process.env.PAYPAL_CLIENT_ID;
const CLIENT_SECRET = process.env.PAYPAL_CLIENT_SECRET;

async function getAccessToken() {
  const auth = Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString('base64');
  
  const response = await fetch(`${PAYPAL_BASE}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${auth}`,
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: 'grant_type=client_credentials'
  });
  
  const data = await response.json();
  return data.access_token;
}

app.get('/paypal-api/auth/browser-safe-client-token', async (req, res) => {
  try {
    const auth = Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString('base64');
    
    const response = await fetch(`${PAYPAL_BASE}/v1/oauth2/token`, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: 'grant_type=client_credentials&response_type=client_token&intent=sdk_init'
    });
    
    const data = await response.json();
    
    res.json({
      accessToken: data.access_token,
      expiresIn: data.expires_in
    });
    
  } catch (error) {
    res.status(500).json({ error: 'TOKEN_GENERATION_FAILED' });
  }
});

module.exports = { app, getAccessToken };
```

