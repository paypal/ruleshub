/**
 * PayPal Standalone Payment Button Integration Guide (v6 SDK)
 * Card and debit card processing without PayPal account requirement
 * Based on: https://docs.paypal.ai/payments/methods/cards/standalone-payment-button
 */
const CARDS_STANDALONE_GUIDE = `
## Standalone Payment Button (v6 JavaScript SDK)

### Overview
Standalone payment buttons allow you to accept card and debit card payments without requiring customers to log in or create a PayPal account. This provides a streamlined checkout experience for guest card payments.

**CRITICAL REQUIREMENT:** Standalone payments require "Advanced Credit and Debit Card Payments" enabled in your PayPal app.

**CRITICAL WARNING:** Do NOT use hard eligibility checks that block initialization. The \`findEligibleMethods()\` API can return false negatives even when your account is properly configured.

**Note:** This guide targets the **v6** Web SDK and **does not** use the legacy v4 \`paypal.FUNDING.CARD\` flow.

### Key Features
- Accept card payments without a PayPal account (guest checkout)
- Simple button integration with custom elements
- Presentation modes: \`auto\`, \`modal\`, \`popup\`, \`redirect\`
- Shipping address validation & shipping options callbacks
- PCI-compliant hosted fields

---

## Flow at a Glance

1) Load SDK (client) → \`onPayPalWebSdkLoaded()\`  
2) Fetch browser-safe client token (client → server)  
3) Create SDK instance with \`components: ['paypal-guest-payments']\`
4) Optional: Check eligibility via \`findEligibleMethods\` (for logging only, NEVER block on results)
5) Create guest one-time payment session with callbacks (wrapped in try-catch)
6) Start checkout on button click → \`session.start({ presentationMode: 'auto' }, createOrder())\`  
7) \`onApprove\` → capture the order (server call)  
8) UX: success/redirect; handle cancel/error; reset button state  
9) (Recommended) Webhooks to reconcile if user closes/refreshes the page

---

## Prerequisites

Before starting, ensure you have:
- PayPal Developer account
- PayPal app created in **Apps & Credentials**
- **"Advanced Credit and Debit Card Payments"** enabled (for standalone payments)
- Client ID and Secret from your PayPal app
- Backend server to call PayPal APIs (never expose secrets)
- HTTPS enabled (required for production)

### Enabling Advanced Card Processing

1. Go to https://developer.paypal.com/dashboard/
2. Navigate to **Apps & Credentials**
3. Select your app (or create a new one)
4. Go to **Features** tab
5. Enable **"Advanced Credit and Debit Card Payments"**
6. If unavailable, create a new sandbox account with this capability

---

## v6 SDK Integration

### Step 1: Server Setup - Client Token Endpoint

Important: v6 SDK requires a browser-safe client token from your backend.

\`\`\`javascript
// Node.js/Express - Backend server setup
const express = require('express');
const crypto = require('crypto');

const app = express();
app.use(express.json());
app.use(express.static('public'));

const PAYPAL_BASE = process.env.PAYPAL_BASE || 'https://api-m.sandbox.paypal.com';
const CLIENT_ID = process.env.PAYPAL_SANDBOX_CLIENT_ID;
const CLIENT_SECRET = process.env.PAYPAL_SANDBOX_CLIENT_SECRET;

// Helper: Get access token
async function getAccessToken(formBody = 'grant_type=client_credentials') {
  const auth = Buffer.from(\`\${CLIENT_ID}:\${CLIENT_SECRET}\`).toString('base64');
  
  const response = await fetch(\`\${PAYPAL_BASE}/v1/oauth2/token\`, {
    method: 'POST',
    headers: {
      'Authorization': \`Basic \${auth}\`,
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: formBody
  });
  
  if (!response.ok) {
    const error = await response.text();
    throw new Error(\`OAuth failed: \${response.status} - \${error}\`);
  }
  
  const data = await response.json();
  return data.access_token;
}

// 1. Client Token Endpoint
app.get('/paypal-api/auth/browser-safe-client-token', async (req, res) => {
  try {
    const clientTokenFormBody = 
      'grant_type=client_credentials&response_type=client_token&intent=sdk_init';
    
    const accessToken = await getAccessToken(clientTokenFormBody);
    res.json({ accessToken });
    
  } catch (error) {
    console.error('Token generation error:', error);
    res.status(500).json({ error: 'token_generation_failed' });
  }
});

// 2. Create Order Endpoint
app.post('/paypal-api/checkout/orders/create', async (req, res) => {
  try {
    const accessToken = await getAccessToken();
    
    const orderResponse = await fetch(\`\${PAYPAL_BASE}/v2/checkout/orders\`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': \`Bearer \${accessToken}\`,
        'PayPal-Request-Id': crypto.randomUUID()
      },
      body: JSON.stringify(req.body)
    });
    
    const orderData = await orderResponse.json();
    
    if (!orderResponse.ok) {
      console.error('Order creation failed:', orderData);
      return res.status(orderResponse.status).json(orderData);
    }
    
    res.json(orderData);
    
  } catch (error) {
    console.error('Order creation error:', error);
    res.status(500).json({ error: 'order_create_error' });
  }
});

// 3. Capture Order Endpoint
app.post('/paypal-api/checkout/orders/:orderId/capture', async (req, res) => {
  try {
    const accessToken = await getAccessToken();
    
    const captureResponse = await fetch(
      \`\${PAYPAL_BASE}/v2/checkout/orders/\${req.params.orderId}/capture\`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': \`Bearer \${accessToken}\`,
          'PayPal-Request-Id': crypto.randomUUID()
        }
      }
    );
    
    const captureData = await captureResponse.json();
    
    if (!captureResponse.ok) {
      console.error('Capture failed:', captureData);
      return res.status(captureResponse.status).json(captureData);
    }
    
    res.json(captureData);
    
  } catch (error) {
    console.error('Capture error:', error);
    res.status(500).json({ error: 'order_capture_error' });
  }
});

app.listen(8080, () => console.log('Server running on port 8080'));
\`\`\`

---

## Integration Pattern: Standard Standalone Button (RECOMMENDED)

CRITICAL: This pattern avoids hard eligibility checks. It attempts session creation directly and handles errors gracefully.

\`\`\`html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Standalone Payment Button</title>
</head>
<body>
  <h1>Checkout</h1>
  
  <div id="paypal-button-container">
    <button id="paypal-button" disabled>Initializing Payment...</button>
  </div>
  
  <script src="app.js"></script>
  <script 
    async
    src="https://www.sandbox.paypal.com/web-sdk/v6/core"
    onload="onPayPalWebSdkLoaded()"
  ></script>
</body>
</html>
\`\`\`

\`\`\`javascript
// app.js - Standalone button implementation

let paymentSession;
let sdkInstance;

async function onPayPalWebSdkLoaded() {
  try {
    console.log('PayPal v6 SDK loaded, initializing...');
    
    // Step 1: Get client token from backend
    const clientToken = await getBrowserSafeClientToken();
    
    // Step 2: Create SDK instance
    console.log('Creating SDK instance...');
    sdkInstance = await window.paypal.createInstance({
      clientToken,
      components: ['paypal-guest-payments'],
      pageType: 'checkout'
    });
    console.log('SDK instance created successfully');
    
    // Step 3: Optional eligibility check
    // CRITICAL: For logging only - do NOT throw errors based on this check
    try {
      const methods = await sdkInstance.findEligibleMethods({ currencyCode: 'USD' });
      console.log('Eligible payment methods:', methods);
      // Do NOT add: if (!methods.some(...)) throw new Error(...)
    } catch (error) {
      console.warn('Eligibility check failed, continuing anyway:', error);
      // Continue execution - do not throw
    }
    
    // Step 4: Create guest payment session
    // CRITICAL: Let this be the true test of availability
    console.log('Creating guest payment session...');
    paymentSession = await sdkInstance.createPayPalGuestOneTimePaymentSession({
      onApprove,
      onCancel,
      onComplete,
      onError
    });
    console.log('Payment session created successfully');
    
    // Step 5: Setup button
    setupPaymentButton();
    
  } catch (error) {
    console.error('Initialization error:', error);
    console.error('Error details:', error.message);
    
    const button = document.getElementById('paypal-button');
    button.textContent = 'Payment Unavailable';
    button.disabled = true;
    
    alert('Payment initialization failed. Please refresh the page.');
  }
}

function setupPaymentButton() {
  const button = document.getElementById('paypal-button');
  button.textContent = 'Pay with Card';
  button.disabled = false;
  
  button.addEventListener('click', async () => {
    try {
      console.log('Payment button clicked');
      button.textContent = 'Processing...';
      button.disabled = true;
      
      await paymentSession.start(
        { presentationMode: 'auto' },
        createOrder()
      );
      
    } catch (error) {
      console.error('Payment start error:', error);
      alert('Failed to start payment. Please try again.');
      button.textContent = 'Pay with Card';
      button.disabled = false;
    }
  });
}

async function getBrowserSafeClientToken() {
  const response = await fetch('/paypal-api/auth/browser-safe-client-token');
  
  if (!response.ok) {
    throw new Error(\`Failed to get client token: \${response.status}\`);
  }
  
  const { accessToken } = await response.json();
  return accessToken;
}

async function createOrder() {
  const response = await fetch('/paypal-api/checkout/orders/create', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      intent: 'CAPTURE',
      purchase_units: [{
        amount: {
          currency_code: 'USD',
          value: '10.00'
        }
      }]
    })
  });
  
  if (!response.ok) {
    throw new Error(\`Failed to create order: \${response.status}\`);
  }
  
  const { id } = await response.json();
  return { orderId: id };
}

async function captureOrder({ orderId }) {
  const response = await fetch(
    \`/paypal-api/checkout/orders/\${orderId}/capture\`,
    { method: 'POST', headers: { 'Content-Type': 'application/json' } }
  );
  
  if (!response.ok) {
    throw new Error(\`Failed to capture order: \${response.status}\`);
  }
  
  return await response.json();
}

// Payment callbacks
async function onApprove(data) {
  console.log('Payment approved:', data);
  
  try {
    const orderData = await captureOrder({ orderId: data.orderId });
    console.log('Payment captured:', orderData);
    window.location.href = '/success?order=' + data.orderId;
  } catch (error) {
    console.error('Capture failed:', error);
    alert('Payment capture failed. Please contact support.');
  }
}

function onCancel(data) {
  console.log('Payment canceled:', data);
  const button = document.getElementById('paypal-button');
  button.textContent = 'Pay with Card';
  button.disabled = false;
}

function onComplete(data) {
  console.log('Payment completed:', data);
}

function onError(error) {
  console.error('Payment error:', error);
  alert('Payment error occurred. Please try again.');
  const button = document.getElementById('paypal-button');
  button.textContent = 'Pay with Card';
  button.disabled = false;
}

window.onPayPalWebSdkLoaded = onPayPalWebSdkLoaded;
\`\`\`

---

## Common Implementation Pitfalls

### CRITICAL Pitfall: Hard Eligibility Checks Cause False Failures

**The Problem:**
The \`findEligibleMethods()\` API can incorrectly report standalone payments as unavailable even when "Advanced Credit and Debit Card Payments" is enabled and your account is properly configured. This causes unnecessary integration failures.

**WRONG Pattern - Do NOT Use This:**
\`\`\`javascript
// Step 3: Check eligibility
const methods = await sdkInstance.findEligibleMethods({ currencyCode: 'USD' });
const isEligible = methods.some(m => m.id === 'paypal-guest-payments');

// DO NOT DO THIS - Will cause false failures
if (!isEligible) {
    throw new Error('Standalone payments not available');
}

// Step 4: Create session
const session = await sdkInstance.createPayPalGuestOneTimePaymentSession({...});
\`\`\`

**Why This Fails:**
Even with Advanced Card Processing enabled, \`findEligibleMethods()\` may not return \`'paypal-guest-payments'\` in the list. This creates a false negative that blocks perfectly valid integrations.

**CORRECT Pattern - Use This:**
\`\`\`javascript
// Step 3: Optional eligibility check (logging only)
try {
    const methods = await sdkInstance.findEligibleMethods({ currencyCode: 'USD' });
    console.log('Eligible methods (informational only):', methods);
    // Do NOT check results or throw errors here
} catch (error) {
    console.warn('Eligibility check failed, continuing anyway:', error);
}

// Step 4: Create session - this is the REAL test of availability
try {
    const session = await sdkInstance.createPayPalGuestOneTimePaymentSession({
        onApprove,
        onCancel,
        onComplete,
        onError
    });
    console.log('Standalone payments available - session created');
} catch (error) {
    console.error('Session creation failed:', error);
    // Handle actual error here
}
\`\`\`

**Key Points:**
- \`findEligibleMethods()\` is unreliable - use for logging only
- Session creation is the authoritative test of availability
- If session creation succeeds, standalone payments work
- If session creation fails, handle the error appropriately

**Common Mistake:**
\`\`\`javascript
// WRONG: Blocking on eligibility check
if (!methods.some(m => m.id === 'paypal-guest-payments')) {
    throw new Error('Not eligible'); // Causes false failures
}

// CORRECT: Skip the check entirely
// Just try to create the session
const session = await sdkInstance.createPayPalGuestOneTimePaymentSession({...});
\`\`\`

---

## Optional: Fallback Pattern for Maximum Robustness

If you want to ensure checkout works even when standalone payments are genuinely unavailable, implement this fallback pattern:

\`\`\`javascript
async function onPayPalWebSdkLoaded() {
  try {
    const clientToken = await getBrowserSafeClientToken();
    
    // Try standalone first
    try {
      sdkInstance = await window.paypal.createInstance({
        clientToken,
        components: ['paypal-guest-payments'],
        pageType: 'checkout'
      });
      console.log('Using standalone payments (card checkout)');
    } catch (error) {
      console.warn('Standalone unavailable, using PayPal wallet:', error);
      sdkInstance = await window.paypal.createInstance({
        clientToken,
        components: ['paypal-payments'],
        pageType: 'checkout'
      });
      console.log('Using PayPal wallet (login required)');
    }
    
    // Try guest session first
    try {
      paymentSession = await sdkInstance.createPayPalGuestOneTimePaymentSession({
        onApprove, onCancel, onComplete, onError
      });
      console.log('Guest payment session created');
    } catch (error) {
      console.warn('Guest session unavailable, using regular session:', error);
      paymentSession = await sdkInstance.createPayPalOneTimePaymentSession({
        onApprove, onCancel, onComplete, onError
      });
      console.log('Regular PayPal session created');
    }
    
    setupPaymentButton();
    
  } catch (error) {
    console.error('Complete initialization failure:', error);
    const button = document.getElementById('paypal-button');
    button.textContent = 'Payment Unavailable';
    button.disabled = true;
  }
}
\`\`\`

---

## Best Practices

### Error Handling
1. Wrap SDK initialization in try-catch blocks
2. Wrap payment session creation in try-catch blocks
3. Log errors with detailed information for debugging
4. **NEVER block on \`findEligibleMethods()\` results** - use for logging only
5. Provide user-friendly error messages without exposing technical details
6. Consider implementing fallback to PayPal wallet for maximum robustness

### Security
1. Keep secrets server-side - Never expose client secret in frontend code
2. Use client tokens from server
3. Validate all orders on backend before capture
4. Use HTTPS in production
5. Add \`PayPal-Request-Id\` with \`crypto.randomUUID()\` for idempotency

### User Experience
1. Show loading states during initialization
2. Disable button until ready
3. Update button text during payment processing
4. Handle all callbacks (onApprove, onCancel, onComplete, onError)
5. Enable retry by resetting button state after errors

---

## Troubleshooting

### Issue 1: False "Not Eligible" Errors

**Symptoms:**
- Error thrown: "Standalone payment button is not eligible"
- \`findEligibleMethods()\` doesn't include 'paypal-guest-payments'
- Account HAS "Advanced Card Processing" enabled
- Integration worked before or works inconsistently

**Root Cause:**
Hard eligibility check blocking initialization based on false negative from \`findEligibleMethods()\` API.

**Solution:**
Remove the hard eligibility check completely:

\`\`\`javascript
// REMOVE THIS CODE:
const isEligible = methods.some(m => m.id === 'paypal-guest-payments');
if (!isEligible) {
    throw new Error('Not eligible'); // DELETE THIS
}

// REPLACE WITH:
// Skip hard check entirely, proceed to session creation
try {
    const session = await sdkInstance.createPayPalGuestOneTimePaymentSession({...});
    console.log('Session created - standalone payments working');
} catch (error) {
    console.error('Session creation failed:', error);
    // Handle genuine failure
}
\`\`\`

### Issue 2: Account Missing Advanced Card Processing

**Symptoms:**
- Error during \`createPayPalGuestOneTimePaymentSession()\`
- Session creation genuinely fails (not eligibility check)

**Root Cause:**
Account doesn't have "Advanced Credit and Debit Card Payments" enabled.

**Solution:**
1. Go to https://developer.paypal.com/dashboard/
2. Apps & Credentials → Your App → Features
3. Enable "Advanced Credit and Debit Card Payments"
4. If unavailable, create new app or sandbox account with this feature
5. Update credentials in .env and restart server

### Issue 3: SDK Initialization Fails

**Symptoms:**
- \`createInstance()\` throws error
- Console shows component not available

**Solutions:**
1. Verify client token is valid from server endpoint
2. Check browser console for detailed error messages
3. Verify "Advanced Card Processing" is enabled
4. Consider implementing fallback pattern

---

## Production Checklist

- [ ] "Advanced Credit and Debit Card Payments" enabled in PayPal app
- [ ] Try-catch blocks around SDK initialization
- [ ] Try-catch blocks around session creation
- [ ] **NO hard eligibility checks blocking initialization**
- [ ] \`findEligibleMethods()\` used for logging only (if at all)
- [ ] Switch SDK URL to production: \`https://www.paypal.com/web-sdk/v6/core\`
- [ ] Use production credentials
- [ ] Add \`PayPal-Request-Id\` for idempotency
- [ ] Error logging implemented
- [ ] HTTPS enabled
- [ ] Test complete payment flow
- [ ] Webhooks configured for reconciliation

---

## Key Differences from v4

| v4 (Deprecated) | v6 (Current) |
|-----------------|--------------|
| \`paypal.FUNDING.CARD\` | \`components: ['paypal-guest-payments']\` |
| \`paypal.Buttons().render()\` | \`createInstance() + session.start()\` |
| \`onAuthorize\` | \`onApprove\` |
| Client ID in script URL | Client token from server |
| v1 Payments API | v2 Orders API |
| \`actions.payment.execute()\` | Server-side capture |

---

## Resources

- Official Documentation: https://docs.paypal.ai/payments/methods/cards/standalone-payment-button
- v6 SDK Reference: https://docs.paypal.ai/payments
- Orders API v2: https://developer.paypal.com/docs/api/orders/v2/
- Developer Dashboard: https://developer.paypal.com/dashboard/

`;

module.exports = { CARDS_STANDALONE_GUIDE };