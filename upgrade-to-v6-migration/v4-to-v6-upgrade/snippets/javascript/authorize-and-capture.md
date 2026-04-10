#### Create Order with AUTHORIZE Intent

```javascript
const { getAccessToken } = require('./auth');
const fetch = require('node-fetch');
const crypto = require('crypto');

const PAYPAL_BASE = process.env.PAYPAL_BASE || 'https://api-m.sandbox.paypal.com';

app.post('/paypal-api/checkout/orders/create-authorize', async (req, res) => {
  try {
    const accessToken = await getAccessToken();
    
    const orderPayload = {
      intent: 'AUTHORIZE',
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

#### Authorize Order

```javascript
app.post('/paypal-api/checkout/orders/:orderId/authorize', async (req, res) => {
  try {
    const { orderId } = req.params;
    const accessToken = await getAccessToken();
    
    const response = await fetch(`${PAYPAL_BASE}/v2/checkout/orders/${orderId}/authorize`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
        'PayPal-Request-Id': crypto.randomUUID()
      },
      body: JSON.stringify({})
    });
    
    const authData = await response.json();
    const authorizationId = authData.purchase_units[0].payments.authorizations[0].id;
    
    res.json({
      authorizationId,
      status: authData.status,
      details: authData
    });
    
  } catch (error) {
    res.status(500).json({ error: 'AUTHORIZATION_FAILED' });
  }
});
```

#### Capture Authorization

```javascript
app.post('/paypal-api/payments/authorizations/:authorizationId/capture', async (req, res) => {
  try {
    const { authorizationId } = req.params;
    const accessToken = await getAccessToken();
    
    const capturePayload = {};
    
    if (req.body.amount) {
      capturePayload.amount = {
        value: req.body.amount,
        currency_code: req.body.currency || 'USD'
      };
    }
    
    capturePayload.final_capture = req.body.finalCapture ?? true;
    
    if (req.body.invoiceId) {
      capturePayload.invoice_id = req.body.invoiceId;
    }
    
    if (req.body.noteToPayer) {
      capturePayload.note_to_payer = req.body.noteToPayer;
    }
    
    const response = await fetch(`${PAYPAL_BASE}/v2/payments/authorizations/${authorizationId}/capture`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
        'PayPal-Request-Id': crypto.randomUUID()
      },
      body: JSON.stringify(capturePayload)
    });
    
    const data = await response.json();
    res.json(data);
    
  } catch (error) {
    res.status(500).json({ error: 'CAPTURE_FAILED' });
  }
});
```

#### Get Authorization Details

```javascript
app.get('/paypal-api/payments/authorizations/:authorizationId', async (req, res) => {
  try {
    const { authorizationId } = req.params;
    const accessToken = await getAccessToken();
    
    const response = await fetch(`${PAYPAL_BASE}/v2/payments/authorizations/${authorizationId}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`
      }
    });
    
    const data = await response.json();
    res.json(data);
    
  } catch (error) {
    res.status(500).json({ error: 'FETCH_FAILED' });
  }
});
```

