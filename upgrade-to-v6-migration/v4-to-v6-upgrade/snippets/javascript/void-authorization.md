#### Void Authorization

```javascript
const { getAccessToken } = require('./auth');
const fetch = require('node-fetch');
const crypto = require('crypto');

const PAYPAL_BASE = process.env.PAYPAL_BASE || 'https://api-m.sandbox.paypal.com';

app.post('/paypal-api/payments/authorizations/:authorizationId/void', async (req, res) => {
  try {
    const { authorizationId } = req.params;
    const accessToken = await getAccessToken();
    
    const response = await fetch(`${PAYPAL_BASE}/v2/payments/authorizations/${authorizationId}/void`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
        'PayPal-Request-Id': crypto.randomUUID()
      },
      body: JSON.stringify({})
    });
    
    res.json({
      success: true,
      authorizationId,
      status: 'VOIDED'
    });
    
  } catch (error) {
    res.status(500).json({ error: 'VOID_FAILED' });
  }
});
```

