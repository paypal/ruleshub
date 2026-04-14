#### Create Order (Basic)

```javascript
const { getAccessToken } = require('./auth');
const fetch = require('node-fetch');
const crypto = require('crypto');

const PAYPAL_BASE = process.env.PAYPAL_BASE || 'https://api-m.sandbox.paypal.com';

app.post('/paypal-api/checkout/orders/create', async (req, res) => {
  try {
    const accessToken = await getAccessToken();
    
    const orderPayload = {
      intent: 'CAPTURE',
      purchase_units: [{
        amount: {
          currency_code: req.body.currency || 'USD',
          value: req.body.amount
        }
      }]
    };
    
    const response = await fetch(`${PAYPAL_BASE}/v2/checkout/orders`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
        'PayPal-Request-Id': crypto.randomUUID()
      },
      body: JSON.stringify(orderPayload)
    });
    
    const data = await response.json();
    res.status(response.status).json(data);
    
  } catch (error) {
    res.status(500).json({ error: 'ORDER_CREATION_FAILED' });
  }
});
```

#### Create Order with Details

```javascript
app.post('/paypal-api/checkout/orders/create-with-details', async (req, res) => {
  try {
    const accessToken = await getAccessToken();
    
    const items = (req.body.items || []).map(item => ({
      name: item.name,
      quantity: String(item.quantity),
      unit_amount: {
        currency_code: req.body.currency || 'USD',
        value: item.price
      },
      sku: item.sku
    }));
    
    const orderPayload = {
      intent: 'CAPTURE',
      purchase_units: [{
        amount: {
          currency_code: req.body.currency || 'USD',
          value: req.body.amount,
          breakdown: {
            item_total: {
              currency_code: req.body.currency || 'USD',
              value: req.body.details?.subtotal || req.body.amount
            },
            shipping: {
              currency_code: req.body.currency || 'USD',
              value: req.body.details?.shipping || '0.00'
            },
            tax_total: {
              currency_code: req.body.currency || 'USD',
              value: req.body.details?.tax || '0.00'
            }
          }
        },
        description: req.body.description || 'Purchase',
        items
      }]
    };
    
    const response = await fetch(`${PAYPAL_BASE}/v2/checkout/orders`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
        'PayPal-Request-Id': crypto.randomUUID()
      },
      body: JSON.stringify(orderPayload)
    });
    
    const data = await response.json();
    res.status(response.status).json(data);
    
  } catch (error) {
    res.status(500).json({ error: 'ORDER_CREATION_FAILED' });
  }
});
```

