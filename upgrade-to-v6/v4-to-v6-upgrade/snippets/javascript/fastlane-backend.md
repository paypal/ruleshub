#### Fastlane - Create Order with Single-Use Token

```javascript
const { getAccessToken } = require('./auth');
const fetch = require('node-fetch');
const crypto = require('crypto');

const PAYPAL_BASE = process.env.PAYPAL_BASE || 'https://api-m.sandbox.paypal.com';

app.post('/paypal-api/checkout/orders/create', async (req, res) => {
  try {
    const accessToken = await getAccessToken();
    const paypalRequestId = req.headers['paypal-request-id'] || crypto.randomUUID();
    
    const response = await fetch(`${PAYPAL_BASE}/v2/checkout/orders`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
        'PayPal-Request-Id': paypalRequestId
      },
      body: JSON.stringify(req.body)
    });
    
    const data = await response.json();
    res.status(response.status).json(data);
    
  } catch (error) {
    res.status(500).json({ error: 'ORDER_CREATION_FAILED' });
  }
});
```

#### CORS Configuration

```javascript
const cors = require('cors');

app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'PayPal-Request-Id']
}));
```

#### Alternative CORS (Manual)

```javascript
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, PayPal-Request-Id');
  
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  
  next();
});
```

