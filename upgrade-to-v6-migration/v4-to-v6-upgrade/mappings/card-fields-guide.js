/**
 * PayPal Card Fields Integration Guide (v6 SDK)
 * Card payments with hosted, PCI-compliant input fields
 * Based on: https://docs.paypal.ai/payments/methods/cards/js-sdk-v6-card-fields-one-time
 */

const CARD_FIELDS_GUIDE = `
## Card Fields Integration (v6 JavaScript SDK)

**This guide is for developers migrating from PayPal checkout.js v4 to v6 SDK.**
Card Fields did NOT exist in v4 - this is a completely new capability available in v6.

### Overview
Card Fields in v6 SDK allow merchants to accept credit/debit cards directly on their website with hosted, PCI-compliant input fields. This provides an alternative to redirecting users to PayPal checkout while maintaining security and compliance.

**Note:** This guide is for PayPal v6 SDK. The v6 SDK has significant architectural differences from v4.

### When to Use Card Fields
- You need direct card payments on your website without redirects
- You want PCI-compliant hosted input fields that integrate with your design
- You need to maintain your site's branding throughout the checkout process
- You require fine control over the payment form appearance
- You want to integrate 3D Secure authentication for fraud protection
- You're building a custom checkout experience

### When to Consider Alternatives
- **For simpler integrations**: Standalone Payment Buttons require less implementation effort
- **For PayPal wallet payments**: Standard PayPal Buttons may be more appropriate
- **For recurring billing**: Subscription or Billing Agreement APIs are designed for this use case

---

## Integration Flow (Step-by-Step)

\`\`\`
1. SERVER STARTUP
   ├─ Configure Express app
   ├─ Define appAccessToken() helper
   ├─ Create GET /paypal-api/auth/browser-safe-client-token
   ├─ Create POST /paypal-api/checkout/orders/create-with-sample-data
   ├─ Create POST /paypal-api/checkout/orders/:orderId/capture
   └─ Start listening on port

2. CLIENT PAGE LOAD
   ├─ Browser loads HTML
   ├─ Load v6 SDK script with onload callback
   ├─ SDK script loads asynchronously
   └─ Calls onPayPalWebSdkLoaded() when ready

3. SDK INITIALIZATION
   ├─ onPayPalWebSdkLoaded() executes
   ├─ Fetch GET /paypal-api/auth/browser-safe-client-token
   │  ├─ Server: OAuth with response_type=client_token
   │  └─ Server returns { accessToken: '...' }
   ├─ Call window.paypal.createInstance({ clientToken, components: ['card-fields'] })
   ├─ Call sdk.findEligibleMethods()
   ├─ Check paymentMethods.isEligible('advanced_cards')
   ├─ If eligible, call setupCardFields(sdk)
   └─ If not eligible, show error or alternative

4. CARD FIELDS SETUP
   ├─ Call sdk.createCardFieldsOneTimePaymentSession()
   ├─ Create number field component
   ├─ Create expiry field component
   ├─ Create CVV field component
   ├─ Append each to respective DOM containers
   └─ Attach click handler to pay button

5. USER INTERACTION
   ├─ User enters card number
   ├─ User enters expiry date (MM/YY)
   ├─ User enters CVV
   └─ User clicks pay button

6. PAYMENT SUBMISSION
   ├─ Pay button click handler fires
   ├─ Add 'is-loading' class to button
   ├─ Call createOrder()
   │  ├─ Fetch POST /paypal-api/checkout/orders/create-with-sample-data
   │  ├─ Server: Get OAuth access token
   │  ├─ Server: POST /v2/checkout/orders to PayPal
   │  ├─ PayPal returns { id, status, links }
   │  └─ Client receives { id: 'orderId' }
   ├─ Call session.submit(orderId, { billingAddress: { postalCode } })
   ├─ SDK validates card fields
   ├─ SDK triggers 3DS if configured server-side
   └─ SDK returns { state, data }

7. HANDLE SUBMISSION RESULT
   ├─ Switch on state value
   ├─ Case 'succeeded':
   │  ├─ Extract orderId and liabilityShift from data
   │  ├─ Call captureOrder(orderId)
   │  │  ├─ POST /paypal-api/checkout/orders/{orderId}/capture
   │  │  ├─ Server: Get OAuth access token
   │  │  ├─ Server: POST /v2/checkout/orders/{orderId}/capture to PayPal
   │  │  └─ Return capture response
   │  ├─ Check capture response status
   │  ├─ Show success message
   │  └─ Redirect to success page
   ├─ Case 'canceled':
   │  ├─ User closed 3DS modal or canceled
   │  └─ Show message allowing retry
   ├─ Case 'failed':
   │  ├─ Field validation or processing failed
   │  └─ Show error from data.message
   └─ Default: Log unhandled state

8. CLEANUP
   └─ Remove 'is-loading' class from button
\`\`\`

---

## Server Implementation (Node.js/Express)

CRITICAL: Use OAuth endpoint with \`response_type=client_token\`, NOT the identity endpoint.

\`\`\`javascript
// server.js - Complete Express server for v6 Card Fields
const express = require('express');
const crypto = require('crypto');

const app = express();
app.use(express.json());
app.use(express.static('public'));

const PAYPAL_BASE = process.env.PAYPAL_BASE || 'https://api-m.sandbox.paypal.com';
const CLIENT_ID = process.env.PAYPAL_CLIENT_ID;
const CLIENT_SECRET = process.env.PAYPAL_CLIENT_SECRET;

// Helper: Get OAuth access token
// CRITICAL: Handles both client_token and access_token response types
async function appAccessToken(formBody) {
  const creds = Buffer.from(\`\${CLIENT_ID}:\${CLIENT_SECRET}\`).toString('base64');
  
  const response = await fetch(\`\${PAYPAL_BASE}/v1/oauth2/token\`, {
    method: 'POST',
    headers: {
      'Authorization': \`Basic \${creds}\`,
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: formBody
  });
  
  if (!response.ok) {
    const error = await response.text();
    throw new Error(\`OAuth failed: \${response.status} - \${error}\`);
  }
  
  const json = await response.json();
  return json.access_token;
}

// 1. Client Token Endpoint
// CRITICAL: Use OAuth endpoint with response_type=client_token
app.get('/paypal-api/auth/browser-safe-client-token', async (req, res) => {
  try {
    const sdkClientTokenFormBody = 
      'grant_type=client_credentials&response_type=client_token&intent=sdk_init';
    
    const access_token = await appAccessToken(sdkClientTokenFormBody);
    
    res.json({ accessToken: access_token });
    
  } catch (error) {
    console.error('Client token error:', error);
    res.status(500).json({ error: 'client_token_error' });
  }
});

// 2. Create Order Endpoint (with sample data)
app.post('/paypal-api/checkout/orders/create-with-sample-data', async (req, res) => {
  try {
    const fullScopeAccessTokenFormBody = 
      'grant_type=client_credentials&response_type=token';
    const accessToken = await appAccessToken(fullScopeAccessTokenFormBody);
    
    const orderResponse = await fetch(\`\${PAYPAL_BASE}/v2/checkout/orders\`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': \`Bearer \${accessToken}\`,
        'PayPal-Request-Id': crypto.randomUUID()
      },
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
    
    const orderData = await orderResponse.json();
    
    if (!orderResponse.ok) {
      console.error('Order creation failed:', orderData);
      return res.status(orderResponse.status).json(orderData);
    }
    
    res.json({ id: orderData.id });
    
  } catch (error) {
    console.error('Order creation error:', error);
    res.status(500).json({ error: 'order_create_error' });
  }
});

// 3. Capture Order Endpoint
app.post('/paypal-api/checkout/orders/:orderId/capture', async (req, res) => {
  try {
    const fullScopeAccessTokenFormBody = 
      'grant_type=client_credentials&response_type=token';
    const accessToken = await appAccessToken(fullScopeAccessTokenFormBody);
    
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

app.listen(3000, () => console.log('Server listening on port 3000'));
\`\`\`

---

## Client-Side Implementation

### HTML Setup

\`\`\`html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Card Fields Payment</title>
  <style>
    .card-fields-container {
      display: flex;
      flex-direction: column;
      gap: 12px;
      max-width: 400px;
    }
    .card-field {
      height: 3rem;
      border: 1px solid #ccc;
      border-radius: 4px;
    }
    #pay-button {
      padding: 12px 16px;
      font-size: 16px;
      background: #0070ba;
      color: white;
      border: none;
      border-radius: 4px;
      cursor: pointer;
    }
    #pay-button:hover {
      background: #005a95;
    }
    .is-loading {
      opacity: 0.6;
      pointer-events: none;
    }
  </style>
</head>
<body>
  <h1>Card Fields Payment</h1>
  
  <div class="card-fields-container">
    <div class="card-field" id="paypal-card-fields-number"></div>
    <div class="card-field" id="paypal-card-fields-expiry"></div>
    <div class="card-field" id="paypal-card-fields-cvv"></div>
  </div>
  
  <button id="pay-button">Pay</button>
  
  <script src="app.js"></script>
  
  <!-- CRITICAL: Load SDK script -->
  <script 
    async 
    src="https://www.sandbox.paypal.com/web-sdk/v6/core" 
    onload="onPayPalWebSdkLoaded()"
  ></script>
</body>
</html>
\`\`\`

### JavaScript Implementation

CRITICAL: Component creation uses \`createCardFieldsComponent()\` and \`appendChild()\`. The v4 SDK's \`.render()\` method does NOT exist in v6.

\`\`\`javascript
// app.js - v6 SDK Card Fields Integration

let cardSession;

// CRITICAL: This function is called when the SDK script loads
async function onPayPalWebSdkLoaded() {
  try {
    // 1. Get client token from your backend
    const clientToken = await getBrowserSafeClientToken();
    
    // 2. Initialize v6 SDK instance
    const sdk = await window.paypal.createInstance({
      clientToken,
      components: ['card-fields'],
      pageType: 'checkout'
    });
    
    // 3. Check eligibility for card fields
    const paymentMethods = await sdk.findEligibleMethods();
    const isCardFieldsEligible = paymentMethods.isEligible('advanced_cards');
    
    if (isCardFieldsEligible) {
      await setupCardFields(sdk);
    } else {
      console.error('Card fields are not eligible');
      alert('Card payments are not available. Please try another payment method.');
    }
    
  } catch (error) {
    console.error('SDK initialization error:', error);
    alert('Failed to initialize payment. Please refresh the page.');
  }
}

async function setupCardFields(sdk) {
  // 4. Create card fields session for one-time payment
  cardSession = sdk.createCardFieldsOneTimePaymentSession();
  
  // 5. Create individual field components
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
  
  // 6. Append fields to DOM containers
  // CRITICAL: Use appendChild(), NOT .render()
  document.querySelector('#paypal-card-fields-number').appendChild(numberField);
  document.querySelector('#paypal-card-fields-expiry').appendChild(expiryField);
  document.querySelector('#paypal-card-fields-cvv').appendChild(cvvField);
  
  // 7. Setup pay button click handler
  const payButton = document.querySelector('#pay-button');
  payButton.addEventListener('click', () => onPayClick(cardSession));
}

async function onPayClick(cardSession) {
  const payButton = document.querySelector('#pay-button');
  
  try {
    // 8. Show loading state
    payButton.classList.add('is-loading');
    
    // 9. Create order on server
    const orderId = await createOrder();
    
    // 10. Submit card session with orderId
    // CRITICAL: Pass orderId as string, NOT as object { orderId }
    const { data, state } = await cardSession.submit(orderId, {
      billingAddress: {
        postalCode: '95131'
      }
    });
    
    // 11. Handle submission result based on state
    switch (state) {
      case 'succeeded': {
        // Extract orderId and liabilityShift
        // CRITICAL: liabilityShift indicates if 3DS occurred
        const capture = await captureOrder(data.orderId);
        console.log('Payment captured:', capture);
        
        alert('Payment captured!');
        window.location.href = '/success';
        break;
      }
      
      case 'canceled': {
        // User closed 3DS modal or canceled
        alert('Authentication canceled. Please try again.');
        break;
      }
      
      case 'failed': {
        // Validation or processing failure
        console.error('Card submission failed:', data);
        alert(data?.message || 'Payment failed. Check your details and try again.');
        break;
      }
      
      default: {
        // Future-proof for other states
        console.warn('Unhandled submission state:', state, data);
        break;
      }
    }
    
  } catch (error) {
    console.error('Payment flow error:', error);
    alert('Unexpected error. Please try again.');
  } finally {
    // 12. Reset button state
    payButton.classList.remove('is-loading');
  }
}

// Helper Functions

async function getBrowserSafeClientToken() {
  const response = await fetch('/paypal-api/auth/browser-safe-client-token', {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' }
  });
  
  if (!response.ok) {
    throw new Error(\`Failed to get client token: \${response.status}\`);
  }
  
  const { accessToken } = await response.json();
  return accessToken;
}

async function createOrder() {
  const response = await fetch('/paypal-api/checkout/orders/create-with-sample-data', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  });
  
  if (!response.ok) {
    throw new Error(\`Failed to create order: \${response.status}\`);
  }
  
  const { id } = await response.json();
  return id; // CRITICAL: Return orderId as string
}

async function captureOrder(orderId) {
  const response = await fetch(\`/paypal-api/checkout/orders/\${orderId}/capture\`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  });
  
  if (!response.ok) {
    throw new Error(\`Failed to capture order: \${response.status}\`);
  }
  
  return response.json();
}

// Make function globally available
window.onPayPalWebSdkLoaded = onPayPalWebSdkLoaded;
\`\`\`

---

## 3D Secure (3DS) Authentication

3DS is configured SERVER-SIDE during order creation. The v6 SDK automatically handles the authentication flow CLIENT-SIDE.

### Enable 3DS (Server-Side Configuration)

CRITICAL: When using 3DS with Card Fields, you MUST include \`experience_context\` with \`return_url\` and \`cancel_url\`.

#### Always Require 3DS

\`\`\`javascript
app.post('/api/paypal/orders/create', async (req, res) => {
  const fullScopeFormBody = 'grant_type=client_credentials&response_type=token';
  const accessToken = await appAccessToken(fullScopeFormBody);
  
  const orderResponse = await fetch(\`\${PAYPAL_BASE}/v2/checkout/orders\`, {
    method: 'POST',
    headers: {
      'Authorization': \`Bearer \${accessToken}\`,
      'Content-Type': 'application/json',
      'PayPal-Request-Id': crypto.randomUUID()
    },
    body: JSON.stringify({
      intent: 'CAPTURE',
      purchase_units: [{
        amount: {
          currency_code: 'USD',
          value: '100.00'
        }
      }],
      payment_source: {
        card: {
          attributes: {
            verification: {
              method: 'SCA_ALWAYS' // Always trigger 3DS
            }
          },
          experience_context: {
            return_url: 'https://example.com/returnUrl', // REQUIRED for 3DS
            cancel_url: 'https://example.com/cancelUrl'  // REQUIRED for 3DS
          }
        }
      }
    })
  });
  
  const orderData = await orderResponse.json();
  
  if (!orderResponse.ok) {
    console.error('Order creation failed:', orderData);
    return res.status(orderResponse.status).json(orderData);
  }
  
  res.json(orderData);
});
\`\`\`

#### Trigger 3DS When Required (Recommended)

\`\`\`javascript
payment_source: {
  card: {
    attributes: {
      verification: {
        method: 'SCA_WHEN_REQUIRED' // Smart 3DS - only when needed
      }
    },
    experience_context: {
      return_url: 'https://example.com/returnUrl', // REQUIRED
      cancel_url: 'https://example.com/cancelUrl'  // REQUIRED
    }
  }
}
\`\`\`

### Client-Side Handling (Automatic)

No client-side code changes needed. The SDK automatically:
1. Detects if 3DS is required
2. Shows authentication modal
3. Handles user authentication
4. Returns result in \`session.submit()\` response

\`\`\`javascript
// The submit() call handles 3DS automatically
const { data, state } = await cardSession.submit(orderId, {
  billingAddress: { postalCode: '95131' }
});

if (state === 'succeeded') {
  // Check if 3DS occurred and liability shifted
  console.log('Liability Shift:', data.liabilityShift);
  // 'POSSIBLE' = 3DS succeeded, liability shifted to issuer
  // 'NO' = No 3DS, liability remains with merchant
  // 'UNKNOWN' = Cannot determine
  
  // Capture order
  const capture = await captureOrder(data.orderId);
}

if (state === 'canceled') {
  // User canceled 3DS authentication
  console.log('User canceled 3DS');
}
\`\`\`

---

## Card Vaulting with v6 SDK (Save Cards for Future Use)

### Save Card WITH Purchase

\`\`\`javascript
// Client-Side - Add checkbox for saving card
const saveCheckbox = document.getElementById('save-card-checkbox');

submitButton.addEventListener('click', async () => {
  // Create order with vault directive
  const orderResponse = await fetch('/api/paypal/orders/create', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      amount: '100.00',
      currency: 'USD',
      saveCard: saveCheckbox.checked // Pass save preference
    })
  });
  
  const orderData = await orderResponse.json();
  
  // Submit session
  const { state, data } = await session.submit(orderData.id, {
    billingAddress: { postalCode: '95131' }
  });
  
  if (state === 'succeeded') {
    const captureResponse = await fetch(\`/api/paypal/orders/\${data.orderId}/capture\`, {
      method: 'POST'
    });
    
    const captureData = await captureResponse.json();
    
    // Extract vault information
    const vault = captureData?.payment_source?.card?.attributes?.vault;
    if (vault) {
      console.log('Vault ID:', vault.id);
      console.log('Customer ID:', vault.customer.id);
      
      // Save these IDs to your database for future use
      await saveVaultIds({
        userId: currentUser.id,
        vaultId: vault.id,
        customerId: vault.customer.id
      });
    }
  }
});
\`\`\`

### Server-Side - Create Order with Vault Directive

\`\`\`javascript
app.post('/api/paypal/orders/create', async (req, res) => {
  const { amount, currency, saveCard } = req.body;
  
  // ... get access token ...
  
  const orderBody = {
    intent: 'CAPTURE',
    purchase_units: [{
      amount: {
        currency_code: currency || 'USD',
        value: amount
      }
    }]
  };
  
  // Add vault directive if user wants to save card
  if (saveCard) {
    orderBody.payment_source = {
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
  
  const orderResponse = await fetch('https://api-m.sandbox.paypal.com/v2/checkout/orders', {
    method: 'POST',
    headers: {
      'Authorization': \`Bearer \${access_token}\`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(orderBody)
  });
  
  const orderData = await orderResponse.json();
  res.json(orderData);
});
\`\`\`

### Pay with Saved Card (Vault ID)

\`\`\`javascript
// Use saved vault ID for payment
app.post('/api/paypal/orders/create-with-vault', async (req, res) => {
  const { amount, currency, vaultId } = req.body;
  
  // ... get access token ...
  
  const orderResponse = await fetch('https://api-m.sandbox.paypal.com/v2/checkout/orders', {
    method: 'POST',
    headers: {
      'Authorization': \`Bearer \${access_token}\`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      intent: 'CAPTURE',
      purchase_units: [{
        amount: {
          currency_code: currency || 'USD',
          value: amount
        }
      }],
      payment_source: {
        card: {
          vault_id: vaultId // Use saved vault ID
        }
      }
    })
  });
  
  const orderData = await orderResponse.json();
  res.json(orderData);
});
\`\`\`


---

## Advanced Features

### Custom Styling

You can style card field components using the \`style\` option. Use camelCase for CSS properties.

\`\`\`javascript
const numberField = cardSession.createCardFieldsComponent({
  type: 'number',
  placeholder: 'Card number',
  style: {
    input: {
      fontSize: '16px',
      fontFamily: 'Arial, sans-serif',
      color: '#333',
      lineHeight: '24px'
    },
    '.invalid': {
      color: '#dc3545'
    },
    '.valid': {
      color: '#28a745'
    }
  }
});
\`\`\`

**Supported Style Properties:**
\`appearance\`, \`background\`, \`border\`, \`borderRadius\`, \`boxShadow\`, \`color\`, \`direction\`, \`font\`, \`fontFamily\`, \`fontSize\`, \`fontSizeAdjust\`, \`fontStretch\`, \`fontStyle\`, \`fontVariant\`, \`fontVariantAlternates\`, \`fontVariantCaps\`, \`fontVariantEastAsian\`, \`fontVariantLigatures\`, \`fontVariantNumeric\`, \`fontWeight\`, \`height\`, \`letterSpacing\`, \`lineHeight\`, \`opacity\`, \`outline\`, \`padding\`, \`paddingBottom\`, \`paddingLeft\`, \`paddingRight\`, \`paddingTop\`, \`textShadow\`, \`transition\`

**Styling Best Practices:**
- Maintain WCAG AA contrast ratios for accessibility
- Use camelCase for all CSS properties
- Avoid implying validation states unless synchronized with actual validation

---

## Common Issues & Solutions

### Issue 1: SDK initialization fails with token error

**Symptoms:** SDK throws error during \`createInstance()\`

**Solutions:**
- Verify \`/paypal-api/auth/browser-safe-client-token\` endpoint is accessible
- Ensure endpoint returns \`{ accessToken: '<token>' }\`
- Check PayPal credentials in environment variables
- Verify you're using OAuth endpoint with \`response_type=client_token\`, NOT \`/v1/identity/generate-token\`

### Issue 2: Card fields not rendering

**Symptoms:** No card fields appear on page

**Solutions:**
- Check eligibility: \`paymentMethods.isEligible('advanced_cards')\` must return \`true\`
- Verify container elements exist in DOM before appending
- Check browser console for JavaScript errors
- Ensure v6 SDK script loaded successfully
- Verify client token is valid

### Issue 3: Pay button doesn't respond

**Symptoms:** Clicking pay button does nothing

**Solutions:**
- Verify button selector matches HTML: \`document.querySelector('#pay-button')\`
- Ensure click handler attached after card fields setup
- Check that \`cardSession\` was created successfully
- Look for JavaScript errors in browser console

### Issue 4: "orderId shape error" during submit

**Symptoms:** \`session.submit()\` throws error about orderId format

**Solutions:**
- CRITICAL: Pass orderId as **string**: \`session.submit(orderId, options)\`
- Do NOT pass object: \`session.submit({ orderId }, options)\` is WRONG
- Verify order creation returned valid \`id\` field
- Ensure orderId is not undefined or null

### Issue 5: 3DS not triggering

**Symptoms:** 3DS challenge doesn't appear for test cards

**Solutions:**
- Set \`verification.method\` to \`SCA_ALWAYS\` server-side
- Include \`experience_context\` with \`return_url\` and \`cancel_url\` (REQUIRED)
- Use proper 3DS test cards
- Test in sandbox environment
- Check server-side order creation includes \`payment_source.card.attributes\`

### Issue 6: Vault ID not in capture response

**Symptoms:** No vault data after capture

**Solutions:**
- Ensure \`store_in_vault: 'ON_SUCCESS'\` in order creation
- Check correct path: \`captureData.payment_source.card.attributes.vault\`
- Verify vault permissions enabled in PayPal account
- Confirm you're checking **capture** response, not order creation response

### Issue 7: Switch statement fall-through

**Symptoms:** Multiple case blocks execute

**Solutions:**
- Include \`break;\` statement at end of each case
- Verify switch statement syntax is correct

---

## Complete Minimal Working Example

\`\`\`html
<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>v6 Card Fields - One-Time Payment</title>
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <style>
    .card-fields-container { display: flex; flex-direction: column; gap: 12px; max-width: 400px; }
    .card-field { height: 3rem; border: 1px solid #ccc; border-radius: 4px; }
    #pay-button { padding: 12px 16px; font-size: 16px; background: #0070ba; color: white; border: none; border-radius: 4px; cursor: pointer; }
    #pay-button:hover { background: #005a95; }
    .is-loading { opacity: 0.6; pointer-events: none; }
  </style>
</head>
<body>
  <h1>Card Fields Payment</h1>
  
  <div class="card-fields-container">
    <div class="card-field" id="paypal-card-fields-number"></div>
    <div class="card-field" id="paypal-card-fields-expiry"></div>
    <div class="card-field" id="paypal-card-fields-cvv"></div>
  </div>
  
  <button id="pay-button">Pay</button>
  
  <script>
    async function onPayPalWebSdkLoaded() {
      try {
        const clientToken = await getBrowserSafeClientToken();
        const sdk = await window.paypal.createInstance({
          clientToken,
          components: ["card-fields"],
          pageType: "checkout"
        });
        
        const paymentMethods = await sdk.findEligibleMethods();
        const isCardFieldsEligible = paymentMethods.isEligible("advanced_cards");
        
        if (isCardFieldsEligible) {
          await setupCardFields(sdk);
        }
      } catch (err) {
        console.error(err);
      }
    }
    
    async function setupCardFields(sdk) {
      const session = sdk.createCardFieldsOneTimePaymentSession();
      
      const numberField = session.createCardFieldsComponent({ type: "number", placeholder: "Card number" });
      const expiryField = session.createCardFieldsComponent({ type: "expiry", placeholder: "MM/YY" });
      const cvvField = session.createCardFieldsComponent({ type: "cvv", placeholder: "CVV" });
      
      document.querySelector("#paypal-card-fields-number").appendChild(numberField);
      document.querySelector("#paypal-card-fields-expiry").appendChild(expiryField);
      document.querySelector("#paypal-card-fields-cvv").appendChild(cvvField);
      
      const button = document.querySelector("#pay-button");
      button.addEventListener("click", async () => {
        try {
          button.classList.add("is-loading");
          const orderId = await createOrder();
          
          const { data, state } = await session.submit(orderId, {
            billingAddress: { postalCode: "95131" }
          });
          
          switch (state) {
            case "succeeded": {
              const capture = await captureOrder(data.orderId);
              alert("Payment captured!");
              break;
            }
            case "canceled": {
              alert("Authentication canceled. Please try again.");
              break;
            }
            case "failed": {
              alert(data?.message || "Payment failed. Check your details and try again.");
              break;
            }
            default: {
              console.warn("Unhandled state", state);
              break;
            }
          }
        } catch (err) {
          console.error(err);
          alert("Unexpected error. Please try again.");
        } finally {
          button.classList.remove("is-loading");
        }
      });
    }
    
    async function getBrowserSafeClientToken() {
      const r = await fetch("/paypal-api/auth/browser-safe-client-token");
      const { accessToken } = await r.json();
      return accessToken;
    }
    
    async function createOrder() {
      const r = await fetch("/paypal-api/checkout/orders/create-with-sample-data", { method: "POST" });
      const { id } = await r.json();
      return id;
    }
    
    async function captureOrder(orderId) {
      const r = await fetch(\`/paypal-api/checkout/orders/\${orderId}/capture\`, { method: "POST" });
      return r.json();
    }
  </script>
  
  <script async src="https://www.sandbox.paypal.com/web-sdk/v6/core" onload="onPayPalWebSdkLoaded()"></script>
</body>
</html>
\`\`\`

---

## Best Practices

### Implementation
1. **Use OAuth endpoint for client tokens** - Use \`response_type=client_token\`, NOT \`/v1/identity/generate-token\`
2. **Check eligibility** - Call \`findEligibleMethods().isEligible('advanced_cards')\` before rendering
3. **Use appendChild()** - Components mount with \`appendChild()\`, not \`.render()\`
4. **Pass orderId as string** - Common error: passing \`{ orderId }\` instead of \`orderId\`
5. **Handle all states** - Implement switch cases for succeeded, failed, and canceled
6. **Include break statements** - Prevent fall-through in switch cases
7. **Add PayPal-Request-Id** - Use \`crypto.randomUUID()\` for idempotency

### 3D Secure
1. **Configure server-side** - Set \`verification.method\` in order creation
2. **Always include experience_context** - \`return_url\` and \`cancel_url\` are REQUIRED for 3DS
3. **Check liabilityShift** - Indicates whether 3DS succeeded and liability shifted
4. **Use SCA_WHEN_REQUIRED** - Best balance of security and user experience
5. **Test thoroughly** - Verify 3DS cards, authentication flows, and cancellation

### Error Handling
1. **Wrap in try-catch** - Handle all async operations
2. **Check response.ok** - Validate HTTP responses before parsing JSON
3. **Log detailed errors** - Include correlation IDs and error details
4. **Show user-friendly messages** - Don't expose technical errors to users
5. **Reset button states** - Always reset in finally blocks

### Security
1. **Use HTTPS in production** - Required for PCI compliance
2. **Validate server-side** - Never trust client-side validation alone
3. **Store secrets securely** - Use environment variables
4. **Log authentication results** - Maintain audit trail for compliance

---

## Production Readiness Checklist

- [ ] Use production SDK: \`https://www.paypal.com/web-sdk/v6/core\`
- [ ] Generate client tokens using OAuth with \`response_type=client_token\`
- [ ] Add PayPal-Request-Id to all order create/capture calls
- [ ] Include experience_context with return_url and cancel_url for 3DS
- [ ] Implement error handling with try-catch blocks
- [ ] Check response.ok before parsing JSON
- [ ] Handle all submit states (succeeded, failed, canceled)
- [ ] Test with 3DS test cards in sandbox
- [ ] Verify PCI DSS compliance requirements
- [ ] Enable HTTPS everywhere
- [ ] Log PayPal correlation IDs for support cases

---

## Key Differences from v4

v4 checkout.js did NOT have Card Fields. This is entirely new in v6.

| v4 (Not Applicable) | v6 Card Fields |
|---------------------|----------------|
| N/A - Feature didn't exist | \`components: ['card-fields']\` |
| \`paypal.FUNDING.CARD\` (different flow) | Card Fields with hosted inputs |
| Client ID in script URL | Client token from server via OAuth |
| \`paypal.Buttons().render()\` | \`createInstance() + appendChild()\` |
| v1 Payments API | v2 Orders API |

---

## Resources

- [Official v6 Card Fields Documentation](https://docs.paypal.ai/payments/methods/cards/js-sdk-v6-card-fields-one-time)
- [v6 Card Vaulting Guide](https://docs.paypal.ai/payments/save/sdk/cards/js-sdk-v6-vault)
- [3D Secure Documentation](https://docs.paypal.ai/payments/methods/cards/3ds)
- [PayPal Orders API v2](https://developer.paypal.com/docs/api/orders/v2/)
- [Sandbox Card Testing](https://developer.paypal.com/tools/sandbox/card-testing/)

---

## Summary

### Implementation Checklist
1. Load v6 SDK: \`https://www.sandbox.paypal.com/web-sdk/v6/core\`
2. Create server endpoint using OAuth: \`grant_type=client_credentials&response_type=client_token&intent=sdk_init\`
3. Return \`{ accessToken: access_token }\`
4. Client: \`createInstance({ clientToken, components: ['card-fields'] })\`
5. Check eligibility: \`paymentMethods.isEligible('advanced_cards')\`
6. Create session: \`sdk.createCardFieldsOneTimePaymentSession()\`
7. Create components: \`createCardFieldsComponent({ type: 'number' })\`
8. Append to DOM: \`container.appendChild(component)\`
9. Create order server-side before submit
10. Submit: \`session.submit(orderId, { billingAddress })\` - pass orderId as STRING
11. Handle states in switch with break statements
12. Capture on server if succeeded
13. Check liabilityShift value for 3DS outcome

### Critical Points to Remember
- Use OAuth \`/v1/oauth2/token\` with \`response_type=client_token\`, NOT \`/v1/identity/generate-token\`
- Pass orderId as **string**, not object
- Use \`appendChild()\`, not \`.render()\`
- Include \`break;\` in all switch cases
- Add \`experience_context\` for 3DS (REQUIRED)
- Use \`crypto.randomUUID()\` for PayPal-Request-Id
- Check \`response.ok\` before parsing JSON
- Handle all three states: succeeded, failed, canceled

`;

module.exports = { CARD_FIELDS_GUIDE };