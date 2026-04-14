#### Capture Order

```javascript
const { getAccessToken } = require('./auth');
const fetch = require('node-fetch');
const crypto = require('crypto');

const PAYPAL_BASE = process.env.PAYPAL_BASE || 'https://api-m.sandbox.paypal.com';

app.post('/paypal-api/checkout/orders/:orderId/capture', async (req, res) => {
  try {
    const { orderId } = req.params;
    const accessToken = await getAccessToken();
    
    const response = await fetch(`${PAYPAL_BASE}/v2/checkout/orders/${orderId}/capture`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
        'PayPal-Request-Id': crypto.randomUUID()
      },
      body: JSON.stringify({})
    });
    
    const data = await response.json();
    res.status(response.status).json(data);
    
  } catch (error) {
    res.status(500).json({ error: 'CAPTURE_FAILED' });
  }
});
```

