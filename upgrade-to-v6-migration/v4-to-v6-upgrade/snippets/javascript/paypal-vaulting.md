#### Create Setup Token (Save PayPal Without Purchase)

```javascript
const { getAccessToken } = require('./auth');
const fetch = require('node-fetch');
const crypto = require('crypto');

const PAYPAL_BASE = process.env.PAYPAL_BASE || 'https://api-m.sandbox.paypal.com';

app.post('/paypal-api/vault/setup-token/create', async (req, res) => {
  try {
    const accessToken = await getAccessToken();
    
    const setupTokenPayload = {
      payment_source: {
        paypal: {
          usage_type: 'MERCHANT',
          customer_type: 'CONSUMER',
          permit_multiple_payment_tokens: true
        }
      }
    };
    
    const response = await fetch(`${PAYPAL_BASE}/v3/vault/setup-tokens`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
        'PayPal-Request-Id': crypto.randomUUID()
      },
      body: JSON.stringify(setupTokenPayload)
    });
    
    const setupData = await response.json();
    
    res.json({
      id: setupData.id,
      status: setupData.status
    });
    
  } catch (error) {
    res.status(500).json({ error: 'SETUP_TOKEN_FAILED' });
  }
});
```

#### Create Payment Token from Setup Token

```javascript
app.post('/paypal-api/vault/payment-token/create', async (req, res) => {
  try {
    const accessToken = await getAccessToken();
    
    const paymentTokenPayload = {
      payment_source: {
        token: {
          id: req.body.vaultSetupToken,
          type: 'SETUP_TOKEN'
        }
      }
    };
    
    const response = await fetch(`${PAYPAL_BASE}/v3/vault/payment-tokens`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
        'PayPal-Request-Id': crypto.randomUUID()
      },
      body: JSON.stringify(paymentTokenPayload)
    });
    
    const tokenData = await response.json();
    
    res.json({
      id: tokenData.id,
      customerId: tokenData.customer.id,
      status: 'saved'
    });
    
  } catch (error) {
    res.status(500).json({ error: 'PAYMENT_TOKEN_FAILED' });
  }
});
```

#### Create Order with Saved PayPal

```javascript
app.post('/paypal-api/checkout/orders/create-with-payment-token', async (req, res) => {
  try {
    const accessToken = await getAccessToken();
    
    const orderPayload = {
      intent: 'CAPTURE',
      purchase_units: [{
        amount: {
          currency_code: req.body.currency || 'USD',
          value: req.body.amount
        }
      }],
      payment_source: {
        paypal: {
          vault_id: req.body.paymentTokenId
        }
      }
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
    
    const orderData = await response.json();
    
    if (orderData.status === 'CREATED') {
      const captureResponse = await fetch(`${PAYPAL_BASE}/v2/checkout/orders/${orderData.id}/capture`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
          'PayPal-Request-Id': crypto.randomUUID()
        },
        body: JSON.stringify({})
      });
      
      const captureData = await captureResponse.json();
      return res.json(captureData);
    }
    
    res.json(orderData);
    
  } catch (error) {
    res.status(500).json({ error: 'ORDER_FAILED' });
  }
});
```

#### List Saved Payment Methods

```javascript
app.get('/paypal-api/customer/payment-methods', async (req, res) => {
  try {
    const { customer_id } = req.query;
    const accessToken = await getAccessToken();
    
    const response = await fetch(`${PAYPAL_BASE}/v3/vault/payment-tokens?customer_id=${customer_id}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`
      }
    });
    
    const tokensData = await response.json();
    
    res.json({
      payment_tokens: tokensData.payment_tokens || [],
      total_items: tokensData.payment_tokens?.length || 0
    });
    
  } catch (error) {
    res.status(500).json({ error: 'FETCH_FAILED' });
  }
});
```

#### Delete Saved Payment Method

```javascript
app.delete('/paypal-api/vault/payment-tokens/:tokenId', async (req, res) => {
  try {
    const { tokenId } = req.params;
    const accessToken = await getAccessToken();
    
    const response = await fetch(`${PAYPAL_BASE}/v3/vault/payment-tokens/${tokenId}`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`
      }
    });
    
    if (response.status === 204) {
      res.json({ success: true, message: 'Payment method deleted' });
    } else {
      res.status(response.status).json({ success: false });
    }
    
  } catch (error) {
    res.status(500).json({ error: 'DELETE_FAILED' });
  }
});
```

