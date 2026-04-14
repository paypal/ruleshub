/**
 * PayPal 3D Secure (3DS) Integration Guide for v6 SDK
 * Strong Customer Authentication (SCA) for card payments
 * Based on: https://docs.paypal.ai/payments/methods/cards/3ds
 */

const THREE_DS_GUIDE = `
## 3D Secure (3DS) Authentication with v6 SDK

**This guide is specifically for developers migrating from PayPal checkout.js v4 to v6 SDK.**
3D Secure did NOT exist in checkout.js v4 - this is a completely new security capability available in v6 that leverages the v2 Orders API.

### Overview
3D Secure (3DS) adds an additional authentication layer to card payments, providing strong customer authentication (SCA) as required by regulations like PSD2 in Europe. When properly implemented, it provides liability shift protection for merchants.

**CRITICAL:** In v6 SDK, 3DS is configured server-side and handled automatically client-side.

---

### When 3DS is Required

#### Mandatory Regions
- **European Union**: Required for most transactions (PSD2/SCA)
- **United Kingdom**: Required for most transactions (UK FCA)
- **India**: Mandatory for all card transactions (RBI guidelines)

#### Optional but Recommended
- **United States**: Optional, useful for high-value or high-risk transactions
- **Brazil**: Recommended for fraud prevention
- **Australia**: Optional, growing adoption

#### Exemptions (EU/UK)
Certain transactions may be exempt from SCA:
- Low-value transactions (under €30)
- Recurring payments (after initial authentication)
- Trusted beneficiaries (merchant whitelisting)
- Corporate payments
- Low-risk transactions (based on bank's risk assessment)

---

## One-Time Payment with 3DS

### Step 1: Server-Side Order Creation

CRITICAL: Configure 3DS in the order creation request. You MUST include \`return_url\` and \`cancel_url\` in \`experience_context\` for 3DS to work.

\`\`\`javascript
// Node.js/Express - Create order with 3DS configuration
const express = require('express');
const crypto = require('crypto');

const app = express();
app.use(express.json());

const PAYPAL_BASE = 'https://api-m.sandbox.paypal.com';
const CLIENT_ID = process.env.PAYPAL_CLIENT_ID;
const CLIENT_SECRET = process.env.PAYPAL_CLIENT_SECRET;

// Helper: Get OAuth access token
async function getAccessToken() {
  const auth = Buffer.from(\`\${CLIENT_ID}:\${CLIENT_SECRET}\`).toString('base64');
  
  const response = await fetch(\`\${PAYPAL_BASE}/v1/oauth2/token\`, {
    method: 'POST',
    headers: {
      'Authorization': \`Basic \${auth}\`,
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: 'grant_type=client_credentials'
  });
  
  if (!response.ok) {
    const error = await response.text();
    throw new Error(\`OAuth failed: \${response.status} - \${error}\`);
  }
  
  const data = await response.json();
  return data.access_token;
}

// Create order endpoint with optional 3DS
app.post('/paypal-api/checkout/orders', async (req, res) => {
  try {
    const { enable3DS, scaMethod = 'SCA_WHEN_REQUIRED' } = req.body || {};
    
    const accessToken = await getAccessToken();
    
    // Build order payload
    const orderBody = {
      intent: 'CAPTURE',
      purchase_units: [{
        amount: {
          currency_code: 'USD',
          value: '100.00'
        }
      }]
    };
    
    // Add 3DS configuration if enabled
    if (enable3DS) {
      orderBody.payment_source = {
        card: {
          attributes: {
            verification: {
              method: scaMethod // SCA_ALWAYS or SCA_WHEN_REQUIRED
            }
          },
          experience_context: {
            return_url: 'https://example.com/returnUrl', // REQUIRED for 3DS
            cancel_url: 'https://example.com/cancelUrl'  // REQUIRED for 3DS
          }
        }
      };
    }
    
    // Create order via PayPal v2 Orders API
    const orderResponse = await fetch(\`\${PAYPAL_BASE}/v2/checkout/orders\`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': \`Bearer \${accessToken}\`,
        'PayPal-Request-Id': crypto.randomUUID()
      },
      body: JSON.stringify(orderBody)
    });
    
    const orderData = await orderResponse.json();
    
    if (!orderResponse.ok) {
      console.error('Order creation failed:', orderData);
      return res.status(orderResponse.status).json(orderData);
    }
    
    res.json(orderData);
    
  } catch (error) {
    console.error('Order creation error:', error);
    res.status(500).json({ error: 'order_create_error', message: error.message });
  }
});

// Capture order endpoint
app.post('/paypal-api/checkout/orders/:orderId/capture', async (req, res) => {
  try {
    const { orderId } = req.params;
    const accessToken = await getAccessToken();
    
    const captureResponse = await fetch(
      \`\${PAYPAL_BASE}/v2/checkout/orders/\${orderId}/capture\`,
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
    
    // Log 3DS details for compliance
    const authResult = captureData?.payment_source?.card?.authentication_result;
    if (authResult) {
      console.log('3DS Authentication Result:', {
        orderId: captureData.id,
        timestamp: new Date().toISOString(),
        liabilityShift: authResult.liability_shift,
        authenticationStatus: authResult.three_d_secure?.authentication_status,
        enrollmentStatus: authResult.three_d_secure?.enrollment_status
      });
    }
    
    res.json(captureData);
    
  } catch (error) {
    console.error('Capture error:', error);
    res.status(500).json({ error: 'capture_error', message: error.message });
  }
});

app.listen(8080);
\`\`\`

### Verification Methods

**SCA_ALWAYS:**
- Attempts 3DS authentication for all eligible cards
- Maximum security
- May reduce conversion rates for low-risk transactions

**SCA_WHEN_REQUIRED (Recommended):**
- Triggers 3DS only when required by regulations or risk assessment
- Best balance of security and user experience
- Complies with PSD2 and other regulations

---

### Step 2: Client-Side Integration

The v6 SDK automatically handles 3DS authentication. No special client-side code needed beyond the standard card fields integration.

\`\`\`javascript
// Initialize SDK and card fields
const clientToken = await getClientToken();
const sdk = await window.paypal.createInstance({
  clientToken,
  components: ['card-fields']
});

const session = sdk.createCardFieldsOneTimePaymentSession();

// Render card fields
const numberField = session.createCardFieldsComponent({
  type: 'number',
  placeholder: 'Card number'
});
const cvvField = session.createCardFieldsComponent({
  type: 'cvv',
  placeholder: 'CVV'
});
const expiryField = session.createCardFieldsComponent({
  type: 'expiry',
  placeholder: 'MM/YY'
});

document.querySelector('#paypal-card-fields-number').appendChild(numberField);
document.querySelector('#paypal-card-fields-cvv').appendChild(cvvField);
document.querySelector('#paypal-card-fields-expiry').appendChild(expiryField);

// Handle payment submission
document.querySelector('#pay-button').addEventListener('click', async () => {
  try {
    // Create order with 3DS enabled
    const orderId = await createOrder({
      enable3DS: true,
      scaMethod: 'SCA_WHEN_REQUIRED'
    });
    
    // Submit - SDK automatically handles 3DS challenge if triggered
    const { state, data } = await session.submit(orderId, {
      billingAddress: { postalCode: '95131' }
    });
    
    switch (state) {
      case 'succeeded': {
        const { orderId, liabilityShift } = data;
        
        // Check liability shift to assess risk
        console.log('Liability Shift:', liabilityShift);
        // Values: 'POSSIBLE' (shifted), 'NO' (not shifted), 'UNKNOWN'
        
        // Capture the order
        const result = await captureOrder(orderId);
        
        // Show success
        alert('Payment successful!');
        window.location.href = '/success';
        break;
      }
      
      case 'canceled': {
        // User closed 3DS modal
        alert('Payment was canceled. Please try again.');
        break;
      }
      
      case 'failed': {
        // Validation or processing failure
        alert(data?.message || 'Payment failed. Please check your card details.');
        break;
      }
      
      default: {
        console.warn('Unhandled state:', state);
        break;
      }
    }
    
  } catch (error) {
    console.error('Payment error:', error);
    alert('An error occurred. Please try again.');
  }
});

// Helper functions
async function getClientToken() {
  const response = await fetch('/paypal-api/auth/browser-safe-client-token');
  const { accessToken } = await response.json();
  return accessToken;
}

async function createOrder(options) {
  const response = await fetch('/paypal-api/checkout/orders', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(options)
  });
  
  if (!response.ok) {
    throw new Error(\`Order creation failed: \${response.status}\`);
  }
  
  const { id } = await response.json();
  return id; // Return orderId as string
}

async function captureOrder(orderId) {
  const response = await fetch(\`/paypal-api/checkout/orders/\${orderId}/capture\`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  });
  
  if (!response.ok) {
    throw new Error(\`Capture failed: \${response.status}\`);
  }
  
  return response.json();
}
\`\`\`

**What happens automatically:**
1. User clicks pay button
2. Client creates order on server with 3DS configuration
3. Client calls \`session.submit(orderId, billingAddress)\`
4. SDK validates card fields
5. If 3DS required, SDK shows authentication modal automatically
6. User completes 3DS challenge (OTP, biometric, etc.)
7. SDK returns with \`state\` ('succeeded', 'canceled', or 'failed')
8. Check \`liabilityShift\` value to assess risk
9. Capture order on server if succeeded

---

## Save Payment Method with 3DS (Vaulting)

### Step 1: Create Vault Setup Token (Server-Side)

CRITICAL: The \`verification_method\` field is at the card level, NOT nested under attributes.

\`\`\`javascript
// POST /paypal-api/vault/setup-token
app.post('/paypal-api/vault/setup-token', async (req, res) => {
  try {
    const { enable3DS, scaMethod = 'SCA_WHEN_REQUIRED' } = req.body || {};
    
    const auth = Buffer.from(\`\${CLIENT_ID}:\${CLIENT_SECRET}\`).toString('base64');
    
    const tokenResponse = await fetch(\`\${PAYPAL_BASE}/v1/oauth2/token\`, {
      method: 'POST',
      headers: {
        'Authorization': \`Basic \${auth}\`,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: 'grant_type=client_credentials'
    });
    
    if (!tokenResponse.ok) {
      const error = await tokenResponse.text();
      throw new Error(\`OAuth failed: \${tokenResponse.status}\`);
    }
    
    const { access_token } = await tokenResponse.json();
    
    // Build setup token payload
    const setupTokenBody = {
      payment_source: {
        card: {}
      }
    };
    
    // Add 3DS configuration if enabled
    // CRITICAL: verification_method is at card level for vault setup tokens
    if (enable3DS) {
      setupTokenBody.payment_source.card = {
        experience_context: {
          return_url: 'https://example.com/returnUrl',
          cancel_url: 'https://example.com/cancelUrl'
        },
        verification_method: scaMethod // CRITICAL: Direct property, not nested
      };
    }
    
    // Create vault setup token
    const setupResponse = await fetch(\`\${PAYPAL_BASE}/v3/vault/setup-tokens\`, {
      method: 'POST',
      headers: {
        'Authorization': \`Bearer \${access_token}\`,
        'Content-Type': 'application/json',
        'PayPal-Request-Id': crypto.randomUUID()
      },
      body: JSON.stringify(setupTokenBody)
    });
    
    const setupData = await setupResponse.json();
    
    if (!setupResponse.ok) {
      console.error('Setup token creation failed:', setupData);
      return res.status(setupResponse.status).json(setupData);
    }
    
    res.json(setupData);
    
  } catch (error) {
    console.error('Setup token creation error:', error);
    res.status(500).json({ error: 'setup_token_error', message: error.message });
  }
});
\`\`\`

### Step 2: Submit Card with Setup Token (Client-Side)

\`\`\`javascript
// Client-side - Save payment method with 3DS
const clientToken = await getClientToken();
const sdk = await window.paypal.createInstance({
  clientToken,
  components: ['card-fields']
});

// CRITICAL: Use createCardFieldsSavePaymentSession for vaulting
const session = sdk.createCardFieldsSavePaymentSession();

// Render card fields
const numberField = session.createCardFieldsComponent({
  type: 'number',
  placeholder: 'Card number'
});
const cvvField = session.createCardFieldsComponent({
  type: 'cvv',
  placeholder: 'CVV'
});
const expiryField = session.createCardFieldsComponent({
  type: 'expiry',
  placeholder: 'MM/YY'
});

document.querySelector('#paypal-card-fields-number').appendChild(numberField);
document.querySelector('#paypal-card-fields-cvv').appendChild(cvvField);
document.querySelector('#paypal-card-fields-expiry').appendChild(expiryField);

// Save card button handler
document.querySelector('#save-card-button').addEventListener('click', async () => {
  try {
    const button = document.querySelector('#save-card-button');
    button.disabled = true;
    button.textContent = 'Processing...';
    
    // Create vault setup token with 3DS
    const setupTokenResponse = await fetch('/paypal-api/vault/setup-token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        enable3DS: true,
        scaMethod: 'SCA_WHEN_REQUIRED'
      })
    });
    
    const { id: setupToken } = await setupTokenResponse.json();
    
    // Submit - 3DS handled automatically by SDK
    const { state, data } = await session.submit(setupToken);
    
    switch (state) {
      case 'succeeded': {
        // CRITICAL: data.vaultSetupToken contains the token to save
        console.log('Card saved successfully');
        console.log('Vault Setup Token:', data.vaultSetupToken);
        
        // Save to your database
        await fetch('/api/user/save-payment-method', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: currentUser.id,
            vaultSetupToken: data.vaultSetupToken
          })
        });
        
        alert('Card saved successfully!');
        break;
      }
      
      case 'canceled': {
        console.log('User canceled 3DS authentication');
        alert('Card save was canceled.');
        break;
      }
      
      case 'failed': {
        console.error('Card save failed:', data);
        alert(data?.message || 'Failed to save card. Please try again.');
        break;
      }
      
      default: {
        console.warn('Unhandled state:', state);
        break;
      }
    }
    
  } catch (error) {
    console.error('Save card error:', error);
    alert('An error occurred. Please try again.');
  } finally {
    const button = document.querySelector('#save-card-button');
    button.disabled = false;
    button.textContent = 'Save Card';
  }
});
\`\`\`

---

## Understanding 3DS Response Codes

### Liability Shift Values (from submit response)

\`\`\`javascript
// Check liabilityShift from submit() response
const { state, data } = await session.submit(orderId, { billingAddress: { postalCode: '95131' } });

if (state === 'succeeded') {
  console.log('Liability Shift:', data.liabilityShift);
}
\`\`\`

| Value | Meaning | Recommended Action |
|-------|---------|-------------------|
| **POSSIBLE** | Liability shifted to card issuer (3DS succeeded) | Safe to capture - protected |
| **NO** | Liability remains with merchant (no 3DS or failed) | Assess risk before capturing |
| **UNKNOWN** | Cannot determine liability status | Evaluate based on business rules |

### 3DS Authentication Status (from capture response)

\`\`\`javascript
// Check authentication details from capture response
const captureData = await captureOrder(orderId);
const authResult = captureData?.payment_source?.card?.authentication_result;

if (authResult) {
  const authStatus = authResult.three_d_secure?.authentication_status;
  const enrollStatus = authResult.three_d_secure?.enrollment_status;
  const liabilityShift = authResult.liability_shift;
}
\`\`\`

**Authentication Status Values:**

| Status | Meaning |
|--------|---------|
| **Y** | Authentication successful |
| **N** | Authentication failed |
| **A** | Attempted authentication |
| **U** | Unable to authenticate |
| **R** | Rejected by issuer |

**Enrollment Status Values:**

| Status | Meaning |
|--------|---------|
| **Y** | Card enrolled in 3DS program |
| **N** | Card not enrolled |
| **U** | Enrollment status unknown |
| **B** | Bypass authentication |

---

## 3DS with Card Vaulting (One-Time Payment + Save)

Combine 3DS with card vaulting to authenticate AND save the card in one transaction:

\`\`\`javascript
// Server-side: Create order with both 3DS and vaulting
const orderBody = {
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
          method: 'SCA_WHEN_REQUIRED' // Enable 3DS
        },
        vault: {
          store_in_vault: 'ON_SUCCESS', // Vault card after successful payment
          usage_type: 'MERCHANT',
          customer_type: 'CONSUMER',
          permit_multiple_payment_tokens: true
        }
      },
      experience_context: {
        return_url: 'https://example.com/returnUrl', // REQUIRED for 3DS
        cancel_url: 'https://example.com/cancelUrl'  // REQUIRED for 3DS
      }
    }
  }
};

const orderResponse = await fetch(\`\${PAYPAL_BASE}/v2/checkout/orders\`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': \`Bearer \${accessToken}\`,
    'PayPal-Request-Id': crypto.randomUUID()
  },
  body: JSON.stringify(orderBody)
});
\`\`\`

\`\`\`javascript
// Client-side: Extract vault information from capture response
const { state, data } = await session.submit(orderId, {
  billingAddress: { postalCode: '95131' }
});

if (state === 'succeeded') {
  // Capture the order
  const captureResponse = await fetch(\`/api/orders/\${data.orderId}/capture\`, {
    method: 'POST'
  });
  
  const captureData = await captureResponse.json();
  
  // CRITICAL: Extract vault information from capture response
  const vaultInfo = captureData?.payment_source?.card?.attributes?.vault;
  
  if (vaultInfo) {
    console.log('Vault ID:', vaultInfo.id);
    console.log('Customer ID:', vaultInfo.customer.id);
    
    // Save to your database for future payments
    await fetch('/api/user/save-vault-info', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: currentUser.id,
        vaultId: vaultInfo.id,
        customerId: vaultInfo.customer.id
      })
    });
  }
}
\`\`\`

**Flow:**
1. User enters card details
2. 3DS challenge shown if required
3. User completes authentication
4. Payment captured
5. Card vaulted for future use
6. Extract vault ID from capture response

---

## Regional Compliance Examples

### EU/UK (PSD2 Requirements)

\`\`\`javascript
// For EU/UK merchants - Use SCA_WHEN_REQUIRED for PSD2 compliance
app.post('/paypal-api/checkout/orders', async (req, res) => {
  const { customerRegion } = req.body;
  
  const orderBody = {
    intent: 'CAPTURE',
    purchase_units: [{
      amount: { currency_code: 'EUR', value: '100.00' }
    }]
  };
  
  // Add 3DS for EU/UK customers
  if (customerRegion === 'EU' || customerRegion === 'UK') {
    orderBody.payment_source = {
      card: {
        attributes: {
          verification: {
            method: 'SCA_WHEN_REQUIRED' // PSD2 compliant
          }
        },
        experience_context: {
          return_url: 'https://example.com/returnUrl',
          cancel_url: 'https://example.com/cancelUrl'
        }
      }
    };
  }
  
  // Create order...
});
\`\`\`

### India (RBI Mandate)

\`\`\`javascript
// For Indian merchants - SCA_ALWAYS is mandatory
if (merchantCountry === 'IN') {
  orderBody.payment_source = {
    card: {
      attributes: {
        verification: {
          method: 'SCA_ALWAYS' // Required by RBI
        }
      },
      experience_context: {
        return_url: 'https://example.com/returnUrl',
        cancel_url: 'https://example.com/cancelUrl'
      }
    }
  };
}
\`\`\`

### USA (Optional - High Value Transactions)

\`\`\`javascript
// For US merchants - Optional 3DS for fraud prevention
const orderAmount = parseFloat(req.body.amount);

if (merchantCountry === 'US' && orderAmount > 500) {
  orderBody.payment_source = {
    card: {
      attributes: {
        verification: {
          method: 'SCA_WHEN_REQUIRED' // Optional for high-value
        }
      },
      experience_context: {
        return_url: 'https://example.com/returnUrl',
        cancel_url: 'https://example.com/cancelUrl'
      }
    }
  };
}
\`\`\`

---

## Best Practices

### Critical Requirements

**MUST DO:**
- Include both \`return_url\` and \`cancel_url\` in \`experience_context\` - REQUIRED for 3DS
- Handle all submit states (succeeded, canceled, failed) with break statements
- Check \`liabilityShift\` value before capturing high-risk payments
- Use HTTPS in production
- Implement 3DS for EU/UK/India transactions (regulatory compliance)
- Add \`PayPal-Request-Id\` header for idempotency
- Check \`response.ok\` before parsing JSON in all fetch calls

### Recommended Practices

**DO:**
- Use \`SCA_WHEN_REQUIRED\` for optimal balance of security and UX
- Log 3DS authentication results for compliance audits
- Store authentication results in database with timestamps
- Monitor liability shift rates and authentication success rates
- Test all authentication flows (success, failure, cancellation)
- Provide clear user messaging during 3DS flow
- Test mobile experience (3DS modals on small screens)
- Handle timeout scenarios gracefully

**DON'T:**
- Skip 3DS in regulated regions (EU/UK/India) - violates regulations
- Omit \`return_url\` or \`cancel_url\` - 3DS will not work
- Use \`SCA_ALWAYS\` unnecessarily - reduces conversion rates
- Capture orders with \`liabilityShift: 'NO'\` for high-risk transactions
- Forget \`break;\` statements in switch cases - causes fall-through
- Retry failed 3DS automatically - requires user action
- Store authentication results client-side only - use server logging

---

## Troubleshooting

### Issue 1: 3DS Modal Not Appearing

**Symptoms:** Payment proceeds without showing authentication challenge

**Solutions:**
- Verify \`verification.method\` is set in server-side order creation
- Ensure \`payment_source.card.attributes.verification.method\` is included
- Use proper 3DS test cards (regular test cards don't trigger 3DS)
- Check that \`experience_context\` with return_url and cancel_url is present
- Verify you're in sandbox mode if testing

### Issue 2: Missing return_url or cancel_url Error

**Symptoms:** Order creation fails with error about missing URLs

**Solutions:**
- Add both \`return_url\` and \`cancel_url\` to \`experience_context\`
- Ensure URLs are valid HTTPS URLs (required)
- Both URLs are mandatory even if you don't use them

### Issue 3: No Liability Shift

**Symptoms:** \`liabilityShift\` is \`NO\` or \`UNKNOWN\` even after 3DS

**Solutions:**
- Verify card is enrolled in 3DS program
- Check authentication completed successfully (status = 'Y')
- Ensure you're using \`SCA_ALWAYS\` or \`SCA_WHEN_REQUIRED\`
- Verify card issuer supports 3DS
- Check for authentication failures in logs

### Issue 4: Vault Setup Token - Incorrect Field Structure

**Symptoms:** Vault setup token creation fails or 3DS doesn't trigger for vaulting

**Root Cause:**
Using \`attributes.verification.method\` instead of \`verification_method\` for vault setup tokens.

**Solution:**
For vault setup tokens, use \`verification_method\` as a direct property:

\`\`\`javascript
// CORRECT for vault setup tokens
payment_source: {
  card: {
    experience_context: { return_url: '...', cancel_url: '...' },
    verification_method: 'SCA_WHEN_REQUIRED' // Direct property
  }
}

// WRONG for vault setup tokens (this is for orders, not setup tokens)
payment_source: {
  card: {
    attributes: {
      verification: { method: 'SCA_WHEN_REQUIRED' } // Wrong for setup tokens
    }
  }
}
\`\`\`

### Issue 5: 3DS Always Failing in Sandbox

**Symptoms:** All 3DS authentication attempts fail

**Solutions:**
- Use correct 3DS test cards from PayPal sandbox documentation
- In sandbox, any OTP/password works for test cards
- Verify network connectivity
- Check browser console for errors

---

## Complete Working Example

\`\`\`javascript
// Complete one-time payment with 3DS
(async () => {
  try {
    // 1. Get client token
    const tokenRes = await fetch('/paypal-api/auth/browser-safe-client-token');
    const { accessToken: clientToken } = await tokenRes.json();
    
    // 2. Initialize SDK
    const sdk = await window.paypal.createInstance({
      clientToken,
      components: ['card-fields'],
      pageType: 'checkout'
    });
    
    // 3. Check eligibility
    const paymentMethods = await sdk.findEligibleMethods();
    const isEligible = paymentMethods.isEligible('advanced_cards');
    
    if (!isEligible) {
      alert('Card payments not available');
      return;
    }
    
    // 4. Create session
    const session = sdk.createCardFieldsOneTimePaymentSession();
    
    // 5. Render fields
    const numberField = session.createCardFieldsComponent({ type: 'number', placeholder: 'Card number' });
    const expiryField = session.createCardFieldsComponent({ type: 'expiry', placeholder: 'MM/YY' });
    const cvvField = session.createCardFieldsComponent({ type: 'cvv', placeholder: 'CVV' });
    
    document.querySelector('#paypal-card-fields-number').appendChild(numberField);
    document.querySelector('#paypal-card-fields-expiry').appendChild(expiryField);
    document.querySelector('#paypal-card-fields-cvv').appendChild(cvvField);
    
    // 6. Handle pay button
    document.getElementById('pay-button').addEventListener('click', async () => {
      try {
        const button = document.getElementById('pay-button');
        button.disabled = true;
        button.textContent = 'Processing...';
        
        // Create order with 3DS
        const orderRes = await fetch('/paypal-api/checkout/orders', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            enable3DS: true,
            scaMethod: 'SCA_WHEN_REQUIRED'
          })
        });
        
        if (!orderRes.ok) {
          throw new Error(\`Order creation failed: \${orderRes.status}\`);
        }
        
        const { id: orderId } = await orderRes.json();
        
        // Submit - 3DS handled automatically
        const { state, data } = await session.submit(orderId, {
          billingAddress: { postalCode: '95131' }
        });
        
        switch (state) {
          case 'succeeded': {
            console.log('Liability Shift:', data.liabilityShift);
            
            // Capture order
            const captureRes = await fetch(
              \`/paypal-api/checkout/orders/\${data.orderId}/capture\`,
              { method: 'POST' }
            );
            
            if (!captureRes.ok) {
              throw new Error(\`Capture failed: \${captureRes.status}\`);
            }
            
            const capture = await captureRes.json();
            
            // Log 3DS details from capture
            const auth = capture?.payment_source?.card?.authentication_result;
            if (auth) {
              console.log('3DS Authentication:', {
                liabilityShift: auth.liability_shift,
                authStatus: auth.three_d_secure?.authentication_status,
                enrollStatus: auth.three_d_secure?.enrollment_status
              });
            }
            
            alert('Payment successful!');
            window.location.href = '/success';
            break;
          }
          
          case 'canceled': {
            alert('Payment was canceled.');
            button.disabled = false;
            button.textContent = 'Pay';
            break;
          }
          
          case 'failed': {
            alert(data?.message || 'Payment failed.');
            button.disabled = false;
            button.textContent = 'Pay';
            break;
          }
          
          default: {
            console.warn('Unhandled state:', state);
            button.disabled = false;
            button.textContent = 'Pay';
            break;
          }
        }
        
      } catch (err) {
        console.error('Payment error:', err);
        alert('An error occurred. Please try again.');
        const button = document.getElementById('pay-button');
        button.disabled = false;
        button.textContent = 'Pay';
      }
    });
    
  } catch (err) {
    console.error('SDK initialization error:', err);
    alert('Failed to initialize payment.');
  }
})();
\`\`\`

---

## Key Differences Between Order Creation and Vault Setup

### Order Creation (One-Time Payment with 3DS)

\`\`\`javascript
// For orders: use attributes.verification.method
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
\`\`\`

### Vault Setup Token (Save Card with 3DS)

\`\`\`javascript
// For vault setup tokens: use verification_method (direct property)
payment_source: {
  card: {
    verification_method: 'SCA_WHEN_REQUIRED', // Direct property
    experience_context: {
      return_url: 'https://example.com/returnUrl',
      cancel_url: 'https://example.com/cancelUrl'
    }
  }
}
\`\`\`

**CRITICAL:** The field structure is different:
- **Orders:** \`attributes.verification.method\`
- **Vault Setup Tokens:** \`verification_method\` (direct)

---

## Additional Resources

- [Official 3DS Documentation](https://docs.paypal.ai/payments/methods/cards/3ds)
- [PSD2 and SCA Compliance Guide](https://developer.paypal.com/docs/checkout/advanced/customize/3d-secure/sca/)
- [3DS Test Cards](https://developer.paypal.com/tools/sandbox/card-testing/)
- [v6 Card Fields Integration](https://docs.paypal.ai/payments/methods/cards/js-sdk-v6-card-fields-one-time)
- [PayPal Orders API v2](https://developer.paypal.com/docs/api/orders/v2/)
- [PayPal Vault API v3](https://developer.paypal.com/docs/api/vault/v3/)

---

**CRITICAL REMINDERS:**
- 3DS is configured SERVER-SIDE during order/token creation
- v6 SDK handles authentication CLIENT-SIDE automatically
- Always include \`return_url\` and \`cancel_url\` in \`experience_context\`
- Different field structures for orders vs vault setup tokens
- Check \`liabilityShift\` in submit response and \`authentication_result\` in capture response
- Use \`SCA_WHEN_REQUIRED\` for best UX unless regulations require \`SCA_ALWAYS\`
`;

module.exports = { THREE_DS_GUIDE };