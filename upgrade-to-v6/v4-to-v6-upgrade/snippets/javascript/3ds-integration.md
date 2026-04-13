#### Create Order with 3D Secure (Always)

```javascript
const { getAccessToken } = require('./auth');
const fetch = require('node-fetch');
const crypto = require('crypto');

const PAYPAL_BASE = process.env.PAYPAL_BASE || 'https://api-m.sandbox.paypal.com';

app.post('/paypal-api/checkout/orders/create-3ds', async (req, res) => {
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
          attributes: {
            verification: {
              method: 'SCA_ALWAYS'
            }
          },
          experience_context: {
            return_url: 'https://example.com/returnUrl',
            cancel_url: 'https://example.com/cancelUrl'
          }
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
    
    const data = await response.json();
    res.status(response.status).json(data);
    
  } catch (error) {
    res.status(500).json({ error: 'ORDER_CREATION_FAILED' });
  }
});
```

#### Create Order with SCA When Required

```javascript
app.post('/paypal-api/checkout/orders/create-sca', async (req, res) => {
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
          attributes: {
            verification: {
              method: 'SCA_WHEN_REQUIRED'
            }
          },
          experience_context: {
            return_url: 'https://example.com/returnUrl',
            cancel_url: 'https://example.com/cancelUrl'
          }
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
    
    const data = await response.json();
    res.status(response.status).json(data);
    
  } catch (error) {
    res.status(500).json({ error: 'ORDER_CREATION_FAILED' });
  }
});
```

#### Vault Setup Token with 3DS

```javascript
app.post('/paypal-api/vault/setup-token-3ds', async (req, res) => {
  try {
    const accessToken = await getAccessToken();
    
    const setupTokenPayload = {
      payment_source: {
        card: {
          experience_context: {
            return_url: 'https://example.com/returnUrl',
            cancel_url: 'https://example.com/cancelUrl'
          },
          verification_method: req.body.scaMethod || 'SCA_WHEN_REQUIRED'
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
    
    const data = await response.json();
    res.json(data);
    
  } catch (error) {
    res.status(500).json({ error: 'SETUP_TOKEN_FAILED' });
  }
});
```

#### Capture with 3DS Logging

```javascript
app.post('/paypal-api/checkout/orders/:orderId/capture-3ds', async (req, res) => {
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
    
    const captureData = await response.json();
    
    const authResult = captureData.payment_source?.card?.authentication_result;
    if (authResult) {
      const threeDS = authResult.three_d_secure;
      console.log('3DS Authentication Result:');
      console.log(`  Order ID: ${captureData.id}`);
      console.log(`  Liability Shift: ${authResult.liability_shift}`);
      console.log(`  Auth Status: ${threeDS?.authentication_status}`);
      console.log(`  Enrollment Status: ${threeDS?.enrollment_status}`);
    }
    
    res.json(captureData);
    
  } catch (error) {
    res.status(500).json({ error: 'CAPTURE_FAILED' });
  }
});
```

