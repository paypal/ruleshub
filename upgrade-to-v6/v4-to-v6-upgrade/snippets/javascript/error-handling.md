#### Enhanced Error Handling with Debug IDs

```javascript
const { getAccessToken } = require('./auth');
const fetch = require('node-fetch');
const crypto = require('crypto');

const PAYPAL_BASE = process.env.PAYPAL_BASE || 'https://api-m.sandbox.paypal.com';

app.post('/paypal-api/checkout/orders/create-with-error-handling', async (req, res) => {
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
    
    if (response.ok) {
      return res.json(data);
    }
    
    const debugId = response.headers.get('PayPal-Debug-Id') || 'N/A';
    
    console.error('Order creation failed - Debug ID:', debugId);
    console.error('Status:', response.status);
    console.error('Error:', data);
    
    res.status(response.status).json({
      error: 'ORDER_CREATION_FAILED',
      debugId,
      status: response.status,
      details: data.details || [],
      message: data.message || 'Failed to create order'
    });
    
  } catch (error) {
    console.error('Unexpected error:', error);
    res.status(500).json({
      error: 'INTERNAL_ERROR',
      message: 'An unexpected error occurred'
    });
  }
});
```

#### Error Handler Middleware

```javascript
async function handlePayPalError(error, operation, requestData = null) {
  const debugId = error.response?.headers?.get?.('PayPal-Debug-Id') || 'N/A';
  const errorData = error.response ? await error.response.json() : {};
  
  console.error('PayPal API Error - Debug ID:', debugId);
  console.error('Status:', error.response?.status);
  console.error('Details:', errorData);
  
  return {
    error: errorData.name || 'API_ERROR',
    debugId,
    message: errorData.message || 'PayPal API error',
    details: errorData.details || []
  };
}

app.use(async (err, req, res, next) => {
  if (err.isPayPalError) {
    const errorResponse = await handlePayPalError(err);
    return res.status(err.response?.status || 500).json(errorResponse);
  }
  
  console.error('Unexpected error:', err);
  res.status(500).json({ error: 'INTERNAL_ERROR' });
});
```

#### Specific Error Handlers

```javascript
function handleValidationError(errorData, debugId) {
  const fieldErrors = (errorData.details || []).map(detail => ({
    field: detail.field,
    issue: detail.issue,
    description: detail.description
  }));
  
  return {
    error: 'VALIDATION_ERROR',
    debugId,
    message: 'Invalid request data',
    fieldErrors
  };
}

function handleAuthenticationError(debugId) {
  return {
    error: 'AUTHENTICATION_FAILED',
    debugId,
    message: 'Invalid or expired credentials'
  };
}

function handlePaymentError(errorData, debugId) {
  const errorName = errorData.name || '';
  let userMessage = 'Payment could not be processed';
  
  if (errorName.includes('INSTRUMENT_DECLINED')) {
    userMessage = 'Payment method was declined. Please try another payment method.';
  } else if (errorName.includes('INSUFFICIENT_FUNDS')) {
    userMessage = 'Insufficient funds. Please try another payment method.';
  } else if (errorName.includes('ORDER_NOT_APPROVED')) {
    userMessage = 'Order was not approved. Please try again.';
  }
  
  return {
    error: errorName,
    debugId,
    message: userMessage,
    details: errorData.details || []
  };
}
```

#### Error Logger

```javascript
function logPayPalError(operation, debugId, statusCode, errorData, requestData = null) {
  console.error('PayPal API Error:', {
    timestamp: new Date().toISOString(),
    operation,
    debug_id: debugId,
    status_code: statusCode,
    error_name: errorData.name,
    error_message: errorData.message,
    error_details: errorData.details,
    request_data: requestData
  });
  
  return debugId;
}

app.post('/paypal-api/checkout/orders/create-with-logging', async (req, res) => {
  try {
    const accessToken = await getAccessToken();
    
    const response = await fetch(`${PAYPAL_BASE}/v2/checkout/orders`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
        'PayPal-Request-Id': crypto.randomUUID()
      },
      body: JSON.stringify(req.body)
    });
    
    const data = await response.json();
    
    if (!response.ok) {
      const debugId = response.headers.get('PayPal-Debug-Id') || 'N/A';
      logPayPalError('create_order', debugId, response.status, data, req.body);
      
      return res.status(response.status).json({
        error: 'ORDER_CREATION_FAILED',
        debugId,
        message: 'Please contact support with this reference number'
      });
    }
    
    res.json(data);
    
  } catch (error) {
    console.error('Unexpected error creating order:', error);
    res.status(500).json({ error: 'INTERNAL_ERROR' });
  }
});
```

