# Card Fields Integration - v6 SDK

## Overview
Complete v6 SDK card fields integration for accepting credit/debit cards with hosted, PCI-compliant input fields.

## HTML Setup

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>PayPal Card Fields - v6 SDK</title>
  <!-- v6 SDK Core Script -->
  <script async src="https://www.sandbox.paypal.com/web-sdk/v6/core" onload="onPayPalWebSdkLoaded()"></script>
</head>
<body>
  <h1>Checkout</h1>
  
  <!-- Card field containers - use these exact IDs for v6 -->
  <div id="paypal-card-fields-number"></div>
  <div id="paypal-card-fields-expiry"></div>
  <div id="paypal-card-fields-cvv"></div>
  
  <button id="pay-button" type="button">Pay Now</button>
  <div id="result-message"></div>
</body>
</html>
```

## Client-Side JavaScript

```javascript
let cardSession;

// This function is called when v6 SDK loads
async function onPayPalWebSdkLoaded() {
  try {
    // Step 1: Get browser-safe client token from your server
    const tokenResponse = await fetch('/paypal-api/auth/browser-safe-client-token');
    const { accessToken } = await tokenResponse.json();
    
    // Step 2: Initialize v6 SDK with client token
    const sdk = await window.paypal.createInstance({
      clientToken: accessToken,
      components: ['card-fields'],
      pageType: 'checkout'
    });
    
    // Step 3: Check eligibility for card fields
    const paymentMethods = await sdk.findEligibleMethods();
    const isCardFieldsEligible = paymentMethods.isEligible('advanced_cards');
    
    if (!isCardFieldsEligible) {
      console.error('Card fields are not eligible');
      document.getElementById('result-message').textContent = 
        'Card payments are not available';
      return;
    }
    
    // Step 4: Create card fields one-time payment session
    cardSession = sdk.createCardFieldsOneTimePaymentSession();
    
    // Step 5: Create individual card field components (v6 way)
    const numberField = cardSession.createCardFieldsComponent({
      type: 'number',
      placeholder: 'Card number'
    });
    
    const expiryField = cardSession.createCardFieldsComponent({
      type: 'expiry',
      placeholder: 'MM/YY'
    });
    
    const cvvField = cardSession.createCardFieldsComponent({
      type: 'cvv',
      placeholder: 'CVV'
    });
    
    // Step 6: Mount components to DOM (v6 uses appendChild)
    document.querySelector('#paypal-card-fields-number').appendChild(numberField);
    document.querySelector('#paypal-card-fields-expiry').appendChild(expiryField);
    document.querySelector('#paypal-card-fields-cvv').appendChild(cvvField);
    
    // Step 7: Set up submit button handler
    const payButton = document.getElementById('pay-button');
    payButton.addEventListener('click', () => onPayButtonClick(cardSession));
    
    console.log('Card fields initialized');
    
  } catch (error) {
    console.error('SDK initialization error:', error);
    document.getElementById('result-message').textContent = 
      'Failed to load payment form';
  }
}

// Handle pay button click
async function onPayButtonClick(session) {
  const payButton = document.getElementById('pay-button');
  const resultMessage = document.getElementById('result-message');
  
  try {
    // Disable button during processing
    payButton.disabled = true;
    payButton.textContent = 'Processing...';
    resultMessage.textContent = '';
    
    // Step 1: Create order on server
    const orderResponse = await fetch('/paypal-api/checkout/orders/create', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        amount: '100.00',
        currency: 'USD'
      })
    });
    
    if (!orderResponse.ok) {
      throw new Error('Failed to create order');
    }
    
    const orderData = await orderResponse.json();
    const orderId = orderData.id;
    
    // Step 2: Submit session with order ID (v6 pattern)
    const { state, data } = await session.submit(orderId, {
      billingAddress: {
        postalCode: '95131' // Optional
      }
    });
    
    // Step 3: Handle response states
    switch (state) {
      case 'succeeded':
        console.log('Payment succeeded:', data);
        
        // Check liability shift (3DS result)
        if (data.liabilityShift) {
          console.log('Liability Shift:', data.liabilityShift);
        }
        
        // Capture the order
        const captureResponse = await fetch(
          `/paypal-api/checkout/orders/${data.orderId}/capture`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            }
          }
        );
        
        if (!captureResponse.ok) {
          throw new Error('Failed to capture order');
        }
        
        const captureData = await captureResponse.json();
        console.log('Capture complete:', captureData);
        
        resultMessage.textContent = 'Payment complete';
        resultMessage.style.color = 'green';
        
        // Redirect to success page
        setTimeout(() => {
          window.location.href = '/success';
        }, 2000);
        break;
        
      case 'failed':
        console.error('Payment failed:', data);
        resultMessage.textContent = 'Payment failed';
        resultMessage.style.color = 'red';
        payButton.disabled = false;
        payButton.textContent = 'Pay Now';
        break;
        
      case 'canceled':
        console.log('Payment canceled by user');
        resultMessage.textContent = 'Payment was canceled';
        resultMessage.style.color = 'orange';
        payButton.disabled = false;
        payButton.textContent = 'Pay Now';
        break;
        
      default:
        console.warn('Unexpected state:', state);
        resultMessage.textContent = 'An unexpected error occurred';
        resultMessage.style.color = 'red';
        payButton.disabled = false;
        payButton.textContent = 'Pay Now';
        break;
    }
    
  } catch (error) {
    console.error('Payment error:', error);
    resultMessage.textContent = 'An error occurred';
    resultMessage.style.color = 'red';
    payButton.disabled = false;
    payButton.textContent = 'Pay Now';
  }
}
```

## Server-Side: Client Token Generation

```javascript
// Node.js/Express - Generate client token endpoint
const express = require('express');
const fetch = require('node-fetch');

const app = express();
const PAYPAL_BASE = 'https://api-m.sandbox.paypal.com';
const CLIENT_ID = process.env.PAYPAL_CLIENT_ID;
const CLIENT_SECRET = process.env.PAYPAL_CLIENT_SECRET;

// Helper to get access token
async function getAccessToken() {
  const auth = Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString('base64');
  
  const response = await fetch(`${PAYPAL_BASE}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${auth}`,
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: 'grant_type=client_credentials'
  });
  
  const { access_token } = await response.json();
  return access_token;
}

// Client token endpoint
app.get('/paypal-api/auth/browser-safe-client-token', async (req, res) => {
  try {
    const accessToken = await getAccessToken();
    
    // Generate client token
    const tokenResponse = await fetch(`${PAYPAL_BASE}/v1/identity/generate-token`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({})
    });
    
    const { client_token } = await tokenResponse.json();
    
    // Return as accessToken (standard format for v6 SDK)
    res.json({ accessToken: client_token });
    
  } catch (error) {
    console.error('Error generating client token:', error);
    res.status(500).json({ error: 'Failed to generate client token' });
  }
});
```

## Server-Side: Order Creation

```javascript
// Create order endpoint
app.post('/paypal-api/checkout/orders/create', express.json(), async (req, res) => {
  try {
    const { amount, currency } = req.body;
    const accessToken = await getAccessToken();
    
    const orderResponse = await fetch(`${PAYPAL_BASE}/v2/checkout/orders`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'PayPal-Request-Id': `${Date.now()}-${Math.random().toString(36).substring(7)}`
      },
      body: JSON.stringify({
        intent: 'CAPTURE',
        purchase_units: [{
          amount: {
            currency_code: currency || 'USD',
            value: amount
          }
        }]
      })
    });
    
    const orderData = await orderResponse.json();
    res.json(orderData);
    
  } catch (error) {
    console.error('Error creating order:', error);
    res.status(500).json({ error: 'Failed to create order' });
  }
});
```

## Server-Side: Order Capture

```javascript
// Capture order endpoint
app.post('/paypal-api/checkout/orders/:orderId/capture', async (req, res) => {
  try {
    const { orderId } = req.params;
    const accessToken = await getAccessToken();
    
    const captureResponse = await fetch(`${PAYPAL_BASE}/v2/checkout/orders/${orderId}/capture`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    });
    
    const captureData = await captureResponse.json();
    res.json(captureData);
    
  } catch (error) {
    console.error('Error capturing order:', error);
    res.status(500).json({ error: 'Failed to capture order' });
  }
});
```

## v6 SDK Requirements

1. **Script Tag**: Use v6 core SDK script
2. **Client Token**: Required from backend
3. **SDK Init**: `window.paypal.createInstance({ clientToken })`
4. **Eligibility**: `sdk.findEligibleMethods().isEligible('advanced_cards')`
5. **Component Creation**: `session.createCardFieldsComponent({ type })`
6. **Mounting**: Use `appendChild()` method
7. **Submit Pattern**: Create order first, then `session.submit(orderId)`
8. **State Handling**: Use switch with `succeeded`, `failed`, `canceled`

## v5 Patterns to Avoid

- `paypal.CardFields()`
- `session.NameField().render()`
- `session.isEligible()`
- `.render('#selector')`
- onApprove/onError callbacks
- Passing `{ orderId }` to submit (use string)

