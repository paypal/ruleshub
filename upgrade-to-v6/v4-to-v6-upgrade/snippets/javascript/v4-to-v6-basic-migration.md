# PayPal checkout.js v4 to v6 - Basic Migration

**Official v4 Archive**: https://developer.paypal.com/docs/archive/  
**Official v6 Documentation**: https://docs.paypal.ai/payments/methods/paypal/sdk/js/v6/paypal-checkout

## Migration Overview

This guide shows how to migrate a basic PayPal checkout.js v4 integration to PayPal v6 Web SDK.

### Key Changes

1. **Script Loading**: Remove client-id from URL
2. **SDK Initialization**: Instance-based instead of global object
3. **Payment Creation**: Move from client to server
4. **Payment Execution**: Move from client to server
5. **Callbacks**: Updated signatures (onApprove returns Promise, onCancel takes no params)

## v4 Integration (Before Migration)

### v4 HTML

```html
<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>PayPal Checkout v4</title>
</head>
<body>
  <h1>Complete Your Purchase</h1>
  
  <!-- Button container -->
  <div id="paypal-button-container"></div>
  
  <!-- Load PayPal checkout.js v4 SDK -->
  <script src="https://www.paypalobjects.com/api/checkout.js"></script>
  
  <!-- Your integration code -->
  <script src="app-v4.js"></script>
</body>
</html>
```

### v4 JavaScript

```javascript
// app-v4.js - PayPal checkout.js v4 Integration

paypal.Button.render({
    // Environment: sandbox or production
    env: 'sandbox',
    
    // Client IDs for each environment
    client: {
        sandbox: 'YOUR_SANDBOX_CLIENT_ID',
        production: 'YOUR_PRODUCTION_CLIENT_ID'
    },
    
    // Show 'Pay Now' button (recommended)
    commit: true,
    
    // Button styling
    style: {
        label: 'paypal',
        size: 'medium',
        shape: 'rect',
        color: 'gold',
        layout: 'horizontal'
    },
    
    // Create payment (runs when button is clicked)
    payment: function(data, actions) {
        return actions.payment.create({
            payment: {
                transactions: [{
                    amount: {
                        total: '177.37',
                        currency: 'USD',
                        details: {
                            subtotal: '154.98',
                            shipping: '9.99',
                            tax: '12.40'
                        }
                    },
                    description: 'Premium Headphones + Phone Case',
                    item_list: {
                        items: [
                            {
                                name: 'Premium Headphones',
                                sku: 'HEADPHONES-001',
                                price: '129.99',
                                currency: 'USD',
                                quantity: 1
                            },
                            {
                                name: 'Phone Case',
                                sku: 'CASE-001',
                                price: '24.99',
                                currency: 'USD',
                                quantity: 1
                            }
                        ]
                    }
                }]
            }
        });
    },
    
    // Execute payment after buyer approval
    onAuthorize: function(data, actions) {
        return actions.payment.execute().then(function(payment) {
            console.log('Payment completed:', payment);
            // Redirect to success page
            window.location.href = `/success.html?paymentId=${payment.id}&PayerID=${data.payerID}`;
        });
    },
    
    // Handle payment cancellation
    onCancel: function(data) {
        console.log('Payment cancelled:', data);
        alert('Payment was cancelled');
    },
    
    // Handle errors
    onError: function(err) {
        console.error('Payment error:', err);
        alert('An error occurred during payment');
    }
    
}, '#paypal-button-container');
```

## v6 Integration (After Migration)

### v6 HTML

```html
<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>PayPal Checkout v6</title>
  <style>
    .buttons-container {
      max-width: 400px;
      margin: 20px auto;
    }
    
    .loading {
      text-align: center;
      padding: 20px;
      color: #666;
    }
  </style>
</head>
<body>
  <h1>Complete Your Purchase</h1>
  
  <div id="loading" class="loading">
    <p>Loading payment options...</p>
  </div>
  
  <div class="buttons-container">
    <!-- PayPal button - hidden until SDK ready -->
    <paypal-button 
      id="paypal-button" 
      type="pay" 
      class="paypal-gold" 
      hidden>
    </paypal-button>
  </div>
  
  <!-- Your integration code MUST load BEFORE SDK -->
  <script src="app-v6.js"></script>
  
  <!-- Load PayPal v6 SDK - NO credentials in URL -->
  <script 
    async 
    src="https://www.sandbox.paypal.com/web-sdk/v6/core" 
    onload="onPayPalWebSdkLoaded()">
  </script>
</body>
</html>
```

### v6 JavaScript (Client-Side)

```javascript
// app-v6.js - PayPal v6 Web SDK Integration

/**
 * Fetch browser-safe client token from server
 * This replaces the client ID from v4
 */
async function getBrowserSafeClientToken() {
  try {
    const response = await fetch('/paypal-api/auth/browser-safe-client-token');
    
    // Validate response is JSON
    const contentType = response.headers.get('content-type');
    if (!contentType?.includes('application/json')) {
      throw new Error('Expected JSON response');
    }
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const { accessToken } = await response.json();
    return accessToken;
    
  } catch (error) {
    console.error('Failed to fetch client token:', error);
    throw error;
  }
}

/**
 * Create order on server
 * This replaces v4's actions.payment.create()
 * MUST return { orderId: "..." }
 */
async function createOrder() {
  try {
    const response = await fetch('/paypal-api/checkout/orders/create', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        amount: '177.37',
        currency: 'USD',
        description: 'Premium Headphones + Phone Case',
        items: [
          {
            name: 'Premium Headphones',
            sku: 'HEADPHONES-001',
            price: '129.99',
            quantity: 1
          },
          {
            name: 'Phone Case',
            sku: 'CASE-001',
            price: '24.99',
            quantity: 1
          }
        ],
        details: {
          subtotal: '154.98',
          shipping: '9.99',
          tax: '12.40'
        }
      })
    });
    
    if (!response.ok) {
      throw new Error(`Order creation failed: ${response.status}`);
    }
    
    const { id } = await response.json();
    console.log('Order created:', id);
    
    // CRITICAL: v6 requires this exact structure
    return { orderId: id };
    
  } catch (error) {
    console.error('Order creation error:', error);
    throw error;
  }
}

/**
 * Capture order on server
 * This replaces v4's actions.payment.execute()
 */
async function captureOrder({ orderId }) {
  try {
    const response = await fetch(
      `/paypal-api/checkout/orders/${orderId}/capture`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        }
      }
    );
    
    if (!response.ok) {
      throw new Error(`Capture failed: ${response.status}`);
    }
    
    const data = await response.json();
    console.log('Payment captured:', data);
    return data;
    
  } catch (error) {
    console.error('Capture error:', error);
    throw error;
  }
}

/**
 * Called when PayPal v6 SDK finishes loading
 * This is the main initialization function
 */
async function onPayPalWebSdkLoaded() {
  try {
    console.log('PayPal v6 SDK loaded');
    
    // Step 1: Get secure client token from server
    console.log('Fetching client token...');
    const clientToken = await getBrowserSafeClientToken();
    console.log('✓ Client token received');
    
    // Step 2: Initialize SDK instance
    console.log('Initializing SDK...');
    const sdkInstance = await window.paypal.createInstance({
      clientToken,
      components: ["paypal-payments"],
      pageType: "checkout",
      locale: "en-US"
    });
    console.log('✓ SDK initialized');
    
    // Step 3: Create payment session with callbacks
    console.log('Creating payment session...');
    const paymentSession = sdkInstance.createPayPalOneTimePaymentSession({
      /**
       * CRITICAL: onApprove MUST return Promise<void>
       * This is different from v4 which returned a promise optionally
       */
      onApprove: async (data) => {
        console.log('Payment approved:', data.orderId);
        try {
          // Capture payment on server
          await captureOrder({ orderId: data.orderId });
          
          // Redirect to success page
          window.location.href = `/success.html?orderId=${data.orderId}`;
        } catch (error) {
          console.error('Payment capture failed:', error);
          alert('Payment processing failed. Please contact support.');
        }
      },
      
      /**
       * CRITICAL: onCancel takes NO parameters
       * This is different from v4 which passed data parameter
       */
      onCancel: () => {
        console.log('Payment cancelled by user');
        alert('Payment was cancelled. Your items are still in your cart.');
      },
      
      /**
       * onError receives Error object only
       */
      onError: (error) => {
        console.error('Payment error:', error);
        
        // Extract debug ID if available
        const debugId = error.details?.debug_id || error.debug_id;
        const message = debugId 
          ? `Payment failed. Reference: ${debugId}` 
          : 'Payment failed. Please try again.';
        
        alert(message);
      }
    });
    console.log('✓ Payment session created');
    
    // Step 4: Setup button click handler
    const button = document.querySelector('#paypal-button');
    button.removeAttribute('hidden');
    
    button.addEventListener('click', async () => {
      try {
        console.log('Starting payment flow...');
        
        // Start payment with auto presentation mode
        await paymentSession.start(
          { presentationMode: 'auto' }, // Auto-select best presentation
          createOrder() // Create order on server
        );
        
      } catch (error) {
        console.error('Payment start failed:', error);
        alert('Failed to start payment. Please try again.');
      }
    });
    
    // Hide loading indicator
    document.getElementById('loading').style.display = 'none';
    console.log('✓ PayPal button ready');
    
  } catch (error) {
    console.error('SDK initialization failed:', error);
    document.getElementById('loading').innerHTML = 
      '<p style="color: red;">Failed to initialize payment system. Please refresh the page.</p>';
  }
}

// Make function globally available for SDK callback
window.onPayPalWebSdkLoaded = onPayPalWebSdkLoaded;
```

### v6 Server-Side (Node.js/Express)

```javascript
// server.js - Server endpoints for v6 integration

const express = require('express');
const axios = require('axios');
require('dotenv').config();

const app = express();
app.use(express.json());

const PAYPAL_CLIENT_ID = process.env.PAYPAL_CLIENT_ID;
const PAYPAL_CLIENT_SECRET = process.env.PAYPAL_CLIENT_SECRET;
const PAYPAL_BASE_URL = process.env.PAYPAL_ENVIRONMENT === 'live'
  ? 'https://api-m.paypal.com'
  : 'https://api-m.sandbox.paypal.com';

/**
 * Generate browser-safe client token
 * GET /paypal-api/auth/browser-safe-client-token
 */
app.get('/paypal-api/auth/browser-safe-client-token', async (req, res) => {
  try {
    const auth = Buffer.from(`${PAYPAL_CLIENT_ID}:${PAYPAL_CLIENT_SECRET}`).toString('base64');
    
    const response = await axios.post(
      `${PAYPAL_BASE_URL}/v1/oauth2/token`,
      'grant_type=client_credentials&response_type=client_token&intent=sdk_init',
      {
        headers: {
          'Authorization': `Basic ${auth}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      }
    );

    res.json({
      accessToken: response.data.access_token,
      expiresIn: response.data.expires_in
    });

  } catch (error) {
    console.error('Token generation error:', error.response?.data);
    res.status(500).json({
      error: 'TOKEN_GENERATION_FAILED',
      debugId: error.response?.headers?.['paypal-debug-id']
    });
  }
});

/**
 * Get PayPal OAuth access token (for server-side API calls)
 */
async function getPayPalAccessToken() {
  const auth = Buffer.from(`${PAYPAL_CLIENT_ID}:${PAYPAL_CLIENT_SECRET}`).toString('base64');
  
  const response = await axios.post(
    `${PAYPAL_BASE_URL}/v1/oauth2/token`,
    'grant_type=client_credentials',
    {
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    }
  );

  return response.data.access_token;
}

/**
 * Create PayPal order
 * POST /paypal-api/checkout/orders/create
 */
app.post('/paypal-api/checkout/orders/create', async (req, res) => {
  try {
    const { amount, currency = 'USD', description, items, details } = req.body;

    // CRITICAL: Always validate amount server-side
    if (!amount || isNaN(parseFloat(amount)) || parseFloat(amount) <= 0) {
      return res.status(400).json({
        error: 'INVALID_AMOUNT',
        message: 'Invalid or missing amount'
      });
    }

    const accessToken = await getPayPalAccessToken();

    // Build order payload
    const orderPayload = {
      intent: 'CAPTURE',
      purchase_units: [{
        amount: {
          currency_code: currency,
          value: parseFloat(amount).toFixed(2),
          breakdown: {
            item_total: { currency_code: currency, value: details?.subtotal || amount },
            shipping: { currency_code: currency, value: details?.shipping || '0.00' },
            tax_total: { currency_code: currency, value: details?.tax || '0.00' }
          }
        },
        description: description || 'Purchase',
        items: items?.map(item => ({
          name: item.name,
          quantity: item.quantity?.toString() || '1',
          unit_amount: {
            currency_code: currency,
            value: parseFloat(item.price).toFixed(2)
          },
          sku: item.sku
        }))
      }]
    };

    console.log('Creating order:', JSON.stringify(orderPayload, null, 2));

    const response = await axios.post(
      `${PAYPAL_BASE_URL}/v2/checkout/orders`,
      orderPayload,
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
          'PayPal-Request-Id': crypto.randomUUID(),
        },
      }
    );

    console.log('Order created:', response.data.id);

    res.json({
      id: response.data.id,
      status: response.data.status
    });

  } catch (error) {
    console.error('Order creation error:', error.response?.data);
    res.status(error.response?.status || 500).json({
      error: 'ORDER_CREATION_FAILED',
      debugId: error.response?.headers?.['paypal-debug-id']
    });
  }
});

/**
 * Capture PayPal order
 * POST /paypal-api/checkout/orders/:orderId/capture
 */
app.post('/paypal-api/checkout/orders/:orderId/capture', async (req, res) => {
  try {
    const { orderId } = req.params;

    const accessToken = await getPayPalAccessToken();

    const response = await axios.post(
      `${PAYPAL_BASE_URL}/v2/checkout/orders/${orderId}/capture`,
      {},
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
          'PayPal-Request-Id': crypto.randomUUID(),
        },
      }
    );

    console.log('Order captured:', response.data.id);

    res.json(response.data);

  } catch (error) {
    console.error('Capture error:', error.response?.data);
    res.status(error.response?.status || 500).json({
      error: 'CAPTURE_FAILED',
      debugId: error.response?.headers?.['paypal-debug-id']
    });
  }
});

app.listen(3000, () => {
  console.log('Server running on http://localhost:3000');
});
```

### Environment Variables (.env)

```bash
# PayPal Configuration
PAYPAL_CLIENT_ID=your_client_id_here
PAYPAL_CLIENT_SECRET=your_client_secret_here
PAYPAL_ENVIRONMENT=sandbox  # or 'live' for production

# Server Configuration
PORT=3000
```

## Migration Comparison

### Key Differences

| Aspect | v4 | v6 |
|--------|----|----|
| **Script URL** | `https://www.paypalobjects.com/api/checkout.js` | `https://www.sandbox.paypal.com/web-sdk/v6/core` |
| **Credentials** | Client ID in button config | Server-generated client token |
| **Initialization** | `paypal.Button.render()` | `window.paypal.createInstance()` |
| **Payment Creation** | `actions.payment.create()` (client) | Server endpoint |
| **Payment Execution** | `actions.payment.execute()` (client) | Server endpoint |
| **onApprove Return** | Optional Promise | **MUST** return `Promise<void>` |
| **onCancel Parameters** | Receives `data` parameter | **NO** parameters |
| **Button Rendering** | JavaScript `.render()` | Web component + click handler |

### Callback Signature Changes

```javascript
// v4 Callbacks
onAuthorize: function(data, actions) {
  return actions.payment.execute(); // Returns promise
}
onCancel: function(data) { // Receives data
  console.log(data);
}

// v6 Callbacks
onApprove: async (data) => { // MUST return Promise<void>
  await captureOrder({ orderId: data.orderId });
}
onCancel: () => { // NO parameters
  console.log('Cancelled');
}
```

## Testing Checklist

- Test v4 and v6 side-by-side in sandbox
- Verify client token generation works
- Test order creation on server
- Test order capture after approval
- Test cancellation flow
- Test error handling
- Verify no credentials exposed in browser
- Test across different browsers
- Verify proper error messages display
- Test with PayPal sandbox test accounts

## Common Issues

### Issue: v6 SDK not loading
**Solution**: Ensure script has `async` attribute and `onload` callback

### Issue: onApprove not working
**Solution**: Make sure it returns `Promise<void>`

### Issue: Order creation fails
**Solution**: Validate amount server-side, check credentials

### Issue: Cannot find orderId
**Solution**: Create order callback must return `{ orderId: "..." }`

## Migration Benefits

- **Enhanced Security**: Credentials never exposed to browser
- **Server Validation**: All amounts validated server-side
- **Better Error Handling**: Comprehensive error codes with Debug IDs
- **TypeScript Support**: Official type definitions available
- **Modern Architecture**: Instance-based SDK with modular components
- **Improved Performance**: On-demand component loading

## Next Steps

After basic migration:
1. Test thoroughly in sandbox
2. Add Pay Later support (separate guide)
3. Add Venmo support (US only)
4. Implement comprehensive error handling
5. Setup webhooks for order events
6. Deploy to production with live credentials

## References

- **v4 Archive**: https://developer.paypal.com/docs/archive/
- **v6 Documentation**: https://docs.paypal.ai/payments/methods/paypal/sdk/js/v6/paypal-checkout
- **TypeScript Types**: https://github.com/paypal/paypal-js/tree/main/packages/paypal-js/types/v6
- **Orders API**: https://docs.paypal.ai/payments/methods/paypal/api/one-time/orders-api-integration

