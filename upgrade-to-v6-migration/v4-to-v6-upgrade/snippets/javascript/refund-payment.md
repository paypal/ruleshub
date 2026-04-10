#### Full Refund

```javascript
const { getAccessToken } = require('./auth');
const fetch = require('node-fetch');
const crypto = require('crypto');

const PAYPAL_BASE = process.env.PAYPAL_BASE || 'https://api-m.sandbox.paypal.com';

app.post('/paypal-api/payments/captures/:captureId/refund', async (req, res) => {
  try {
    const { captureId } = req.params;
    const accessToken = await getAccessToken();
    
    const response = await fetch(`${PAYPAL_BASE}/v2/payments/captures/${captureId}/refund`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
        'PayPal-Request-Id': crypto.randomUUID()
      },
      body: JSON.stringify({})
    });
    
    const data = await response.json();
    res.json(data);
    
  } catch (error) {
    res.status(500).json({ error: 'REFUND_FAILED' });
  }
});
```

#### Partial Refund

```javascript
app.post('/paypal-api/payments/captures/:captureId/refund-partial', async (req, res) => {
  try {
    const { captureId } = req.params;
    const accessToken = await getAccessToken();
    
    const refundPayload = {
      amount: {
        value: req.body.amount,
        currency_code: req.body.currency || 'USD'
      }
    };
    
    if (req.body.note) {
      refundPayload.note_to_payer = req.body.note;
    }
    
    if (req.body.invoiceId) {
      refundPayload.invoice_id = req.body.invoiceId;
    }
    
    const response = await fetch(`${PAYPAL_BASE}/v2/payments/captures/${captureId}/refund`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
        'PayPal-Request-Id': crypto.randomUUID()
      },
      body: JSON.stringify(refundPayload)
    });
    
    const refundData = await response.json();
    
    res.json({
      refundId: refundData.id,
      status: refundData.status,
      amount: refundData.amount,
      details: refundData
    });
    
  } catch (error) {
    res.status(500).json({ error: 'REFUND_FAILED' });
  }
});
```

#### Get Refund Details

```javascript
app.get('/paypal-api/payments/refunds/:refundId', async (req, res) => {
  try {
    const { refundId } = req.params;
    const accessToken = await getAccessToken();
    
    const response = await fetch(`${PAYPAL_BASE}/v2/payments/refunds/${refundId}`, {
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

#### Get Order Details for Refund

```javascript
app.get('/paypal-api/checkout/orders/:orderId/details', async (req, res) => {
  try {
    const { orderId } = req.params;
    const accessToken = await getAccessToken();
    
    const response = await fetch(`${PAYPAL_BASE}/v2/checkout/orders/${orderId}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`
      }
    });
    
    const orderData = await response.json();
    const captures = orderData.purchase_units[0]?.payments?.captures || [];
    const captureId = captures[0]?.id || null;
    
    res.json({
      orderId,
      captureId,
      status: orderData.status,
      details: orderData
    });
    
  } catch (error) {
    res.status(500).json({ error: 'FETCH_FAILED' });
  }
});
```

