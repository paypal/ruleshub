#### Create Order with Vault Directive

```javascript
const { getAccessToken } = require('./auth');
const fetch = require('node-fetch');
const crypto = require('crypto');

const PAYPAL_BASE = process.env.PAYPAL_BASE || 'https://api-m.sandbox.paypal.com';

app.post('/paypal-api/checkout/orders/create-with-vault', async (req, res) => {
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
    
    if (req.body.saveCard) {
      orderPayload.payment_source = {
        card: {
          attributes: {
            verification: {
              method: 'SCA_WHEN_REQUIRED'
            },
            vault: {
              store_in_vault: 'ON_SUCCESS',
              usage_type: 'MERCHANT',
              customer_type: 'CONSUMER',
              permit_multiple_payment_tokens: true
            }
          }
        }
      };
    }
    
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

#### Create Order with Vault ID

```javascript
app.post('/paypal-api/checkout/orders/create-with-vault-id', async (req, res) => {
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
        card: {
          vault_id: req.body.vaultId
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
    res.json(captureData);
    
  } catch (error) {
    res.status(500).json({ error: 'PAYMENT_FAILED' });
  }
});
```

#### List Payment Tokens

```javascript
app.get('/paypal-api/vault/payment-tokens', async (req, res) => {
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
    
    const data = await response.json();
    res.json(data);
    
  } catch (error) {
    res.status(500).json({ error: 'FETCH_FAILED' });
  }
});
```

#### Delete Payment Token

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
      res.json({ success: true, message: 'Card deleted successfully' });
    } else {
      res.status(response.status).json({ success: false });
    }
    
  } catch (error) {
    res.status(500).json({ error: 'DELETE_FAILED' });
  }
});
```

