# PayPal Fastlane Integration Guide (v6 SDK)

Accelerated guest checkout for returning customers

Based on: https://docs.paypal.ai/payments/methods/cards/fastlane

**IMPORTANT:** Fastlane in v6 SDK uses createInstance() with CLIENT TOKEN. This is different from v4 which uses script tag and Client ID in frontend.

**UPDATED:** November 2024 - After complete debugging and successful implementation

---

## Overview

Fastlane is PayPal's accelerated checkout experience designed to speed up guest checkout for returning customers. It provides one-click-like checkout for guests without requiring a PayPal account, reducing friction and increasing conversion rates.

**IMPORTANT:** Fastlane in v6 SDK uses `createInstance()` with a client token, NOT the v4 pattern with `<script src="https://www.paypalobjects.com/api/checkout.js"></script>` and Client ID!

### Key Benefits

- **Faster Checkout**: Pre-filled shipping and billing information for returning guests
- **No Account Required**: Works for guest users across participating merchants
- **Profile Recognition**: Automatically recognizes returning customers
- **Increased Conversion**: Reduces cart abandonment with streamlined flow
- **Cross-Merchant**: Profile works across all Fastlane-enabled merchants
- **Payment Component Integration**: Works with FastlanePaymentComponent

### How Fastlane Works

1. Customer enters their email at checkout
2. Fastlane recognizes if they've used Fastlane before
3. Customer authenticates (OTP via SMS or email)
4. Saved information (shipping, billing, payment) auto-fills
5. Customer completes checkout in seconds

### When to Use Fastlane

- You want to optimize guest checkout experience
- You have repeat customers who don't use PayPal accounts
- You want to reduce checkout abandonment
- You need faster checkout without requiring account creation
- You want to accelerate card payments

---

## Implementation Overview

Fastlane integration has four main components:

1. **Backend Client Token Endpoint** - Provides secure client tokens for SDK initialization
2. **Watermark** - Shows Fastlane branding for profile recognition
3. **Identity** - Looks up and authenticates returning customers
4. **Payment Component** - Collects payment information with saved profiles

---

## Key Architectural Changes: v4 vs v6 Fastlane

### Authentication Model

#### v4 (Client ID in Frontend - NO Fastlane)

```javascript
// v4: Client ID exposed in browser
paypal.Button.render({
    env: 'sandbox',
    client: {
        sandbox: 'YOUR_CLIENT_ID',  // Exposed in frontend
        production: 'YOUR_CLIENT_ID'
    },
    funding: {
        allowed: [ paypal.FUNDING.CARD ]  // Basic card support only
    }
    // ...
}, '#button-container');
```

#### v6 (Client Token from Backend - WITH Fastlane)

```javascript
// v6: Secure client token from backend
const clientToken = await getBrowserSafeClientToken(); // From your backend
const sdkInstance = await window.paypal.createInstance({
  clientToken,                          // Secure token
  components: ['fastlane'],             // Request Fastlane
  clientMetadataId: crypto.randomUUID() // Session tracking
});
```

---

## Prerequisites

### Backend Requirements

**CRITICAL:** You **MUST** create a backend endpoint that generates client tokens:

```javascript
// Node.js/Express - Client Token Endpoint
app.get('/paypal-api/auth/browser-safe-client-token', async (req, res) => {
  const auth = Buffer.from(
    `${process.env.PAYPAL_CLIENT_ID}:${process.env.PAYPAL_CLIENT_SECRET}`
  ).toString('base64');
  
  // Step 1: Get access token
  const response = await fetch(
    'https://api-m.sandbox.paypal.com/v1/oauth2/token',
    {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: 'grant_type=client_credentials&response_type=client_token&intent=sdk_init'
    }
  );
  
  const tokenData = await response.json();
  
  // Step 2: Return client token
  res.json({ accessToken: tokenData.access_token });
});
```

**CRITICAL:** You also need CORS middleware that allows the `PayPal-Request-Id` header:

```javascript
// CORS Configuration - REQUIRED for Fastlane
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  // CRITICAL: Must include PayPal-Request-Id
  res.header("Access-Control-Allow-Headers", "Content-Type, Authorization, PayPal-Request-Id");
  res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  
  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  
  next();
});
```

**Common Error:** If you forget to add `PayPal-Request-Id` to CORS headers, you'll get:

```
PAYPAL_REQUEST_ID_REQUIRED: A PayPal-Request-Id is required
```

---

## Step-by-Step Integration

### Step 1: Load v6 SDK Core

**CRITICAL:** Fastlane in v6 uses the core SDK, NOT the old script tag pattern!

```html
<!-- Load v6 SDK Core -->
<script 
  async 
  onload="onPayPalLoaded()" 
  src="https://www.sandbox.paypal.com/web-sdk/v6/core"
></script>
```

**Note**: Use production URL in production: `https://www.paypal.com/web-sdk/v6/core`

### Step 2: HTML Structure

**CRITICAL:** You MUST include BOTH `#watermark-container` and `#payment-container`:

```html
<!-- Email form -->
<form id="email-form">
  <label for="email-input">Email</label>
  <input type="email" id="email-input" placeholder="Enter your email" required>
  
  <!-- CRITICAL: Watermark container - MUST EXIST -->
  <div id="watermark-container"></div>
  
  <button id="email-submit-button" type="submit">Continue</button>
</form>

<!-- CRITICAL: Payment component container - MUST EXIST -->
<div id="payment-container"></div>

<!-- Shipping display for returning customers -->
<div id="shipping-display-container" hidden>
  <h3>Shipping Address</h3>
  <div id="shipping-info"></div>
</div>
<button id="change-shipping-button" hidden>Change Shipping Address</button>

<!-- Order submission -->
<button id="submit-button" hidden>Place Order</button>

<!-- Card testing info -->
<p id="card-testing-info" hidden>
  For testing cards, see: 
  <a href="https://developer.paypal.com/tools/sandbox/card-testing/">
    PayPal Card Testing Guide
  </a>
</p>
```

**Common Error:** If these containers are missing, you'll see:

```
FastlaneError: could not find container to render FastlaneWatermarkComponent
```

### Step 3: Fetch Client Token from Backend

```javascript
// Helper function to get client token from your backend
async function getBrowserSafeClientToken() {
  const response = await fetch('/paypal-api/auth/browser-safe-client-token');
  const data = await response.json();
  return data.accessToken;
}
```

### Step 4: Initialize v6 SDK and Fastlane

**CRITICAL CHANGES FROM INITIAL CODE:**
1. Must include `'fastlane'` in components array
2. Must add `clientMetadataId` for session tracking
3. Must call `setLocale()` after creating Fastlane
4. Must render watermark component

```javascript
let fastlane;
let sdkInstance;

async function onPayPalLoaded() {
  try {
    console.log('Initializing PayPal v6 SDK with Fastlane...');
    
    // Get client token from backend
    const clientToken = await getBrowserSafeClientToken();
    console.log('Client token obtained');
    
    // CRITICAL: Must include all three properties
    sdkInstance = await window.paypal.createInstance({
      clientToken,
      pageType: 'checkout',                  // or 'product-details', 'cart'
      clientMetadataId: crypto.randomUUID(), // CRITICAL: Unique session ID
      components: ['fastlane']               // CRITICAL: Request Fastlane
    });
    
    console.log('v6 SDK initialized successfully');
    
    // Create Fastlane instance from SDK
    fastlane = await sdkInstance.createFastlane();
    console.log('Fastlane instance created');
    
    // CRITICAL: Set locale
    fastlane.setLocale('en_us');
    
    // Setup Fastlane UI
    await setupFastlaneSdk();
    
    console.log('Fastlane initialization complete');
    
  } catch (error) {
    console.error('Fastlane initialization error:', error);
    // Fallback to standard checkout
    showStandardCheckout();
  }
}

async function setupFastlaneSdk() {
  // CRITICAL: Render Fastlane watermark
  const fastlaneWatermark = await fastlane.FastlaneWatermarkComponent({
    includeAdditionalInfo: true
  });
  fastlaneWatermark.render('#watermark-container');
  console.log('Watermark rendered');
  
  // Setup email form handler
  const emailForm = document.getElementById('email-form');
  emailForm.addEventListener('submit', handleEmailSubmit);
}
```

**Debugging Tip:** Check console for these success messages in order:
1. "Client token obtained"
2. "v6 SDK initialized successfully"
3. "Fastlane instance created"
4. "Watermark rendered"

---

## Email Lookup & Authentication

### Step 5: Implement Email Lookup Flow

**CRITICAL:** 
- Store profile data and component reference globally
- Authentication happens on email blur/submit, NOT on checkout button
- Handle ALL authentication states (succeeded, failed, canceled)

```javascript
// CRITICAL: Store these globally for use in checkout
let customerProfileData = null;
let fastlanePaymentComponent = null;

async function handleEmailSubmit(event) {
  event.preventDefault();
  
  const emailInput = document.getElementById('email-input');
  const email = emailInput.value.trim();
  
  // Validate email format
  if (!email || !isValidEmail(email)) {
    alert('Please enter a valid email address');
    return;
  }
  
  try {
    console.log('Looking up customer:', email);
    
    // Look up customer by email
    const { customerContextId } = await fastlane.identity.lookupCustomerByEmail(email);
    
    let shouldRenderFastlaneMemberExperience = false;
    let profileData;
    
    if (customerContextId) {
      console.log('Returning customer found!');
      
      // CRITICAL: Trigger authentication for recognized customer
      const response = await fastlane.identity.triggerAuthenticationFlow(customerContextId);
      
      // CRITICAL: Log authentication state for debugging
      console.log('Auth state:', response.authenticationState);
      
      // CRITICAL: Handle ALL possible authentication states
      if (response.authenticationState === 'succeeded') {
        shouldRenderFastlaneMemberExperience = true;
        profileData = response.profileData; // Get from auth response
        console.log('Customer authenticated via Fastlane');
      } else if (response.authenticationState === 'failed') {
        console.log('Authentication failed - showing guest experience');
      } else if (response.authenticationState === 'canceled') {
        console.log('User canceled authentication - showing guest experience');
      } else {
        console.log(`Unexpected state: ${response.authenticationState}`);
      }
    } else {
      console.log('New customer - standard checkout flow');
    }
    
    // Route to appropriate experience
    if (shouldRenderFastlaneMemberExperience) {
      await renderFastlaneMemberExperience(profileData);
    } else {
      await renderFastlaneGuestExperience();
    }
    
  } catch (error) {
    console.error('Fastlane lookup error:', error);
    // Fallback to guest experience
    await renderFastlaneGuestExperience();
  }
}

// Helper function to validate email
function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}
```

**Common Mistake:** 
- WRONG: Calling `showShippingAddressSelector()` directly
- CORRECT: Getting profile from `response.profileData`

---

## Payment Component Integration

### Step 6: Render FastlanePaymentComponent for Members

**CRITICAL:** 
- Component is called `FastlanePaymentComponent`, NOT FastlaneCardComponent
- Render IMMEDIATELY after authentication, NOT on checkout button click
- Store component reference globally for token retrieval

```javascript
async function renderFastlaneMemberExperience(profileData) {
  // CRITICAL: Store profile data globally
  customerProfileData = profileData;
  
  // Display shipping address if available
  if (profileData.shippingAddress) {
    setShippingAddressDisplay(profileData.shippingAddress);
    
    // Show change address button
    const changeAddressButton = document.getElementById('change-shipping-button');
    changeAddressButton.removeAttribute('hidden');
    
    // Allow user to change shipping address
    changeAddressButton.addEventListener('click', async () => {
      const { selectedAddress, selectionChanged } = 
        await fastlane.profile.showShippingAddressSelector();
      
      if (selectionChanged) {
        customerProfileData.shippingAddress = selectedAddress;
        setShippingAddressDisplay(customerProfileData.shippingAddress);
      }
    });
  }
  
  // CRITICAL: Render payment component with pre-filled shipping address
  fastlanePaymentComponent = await fastlane.FastlanePaymentComponent({
    options: {},
    shippingAddress: profileData.shippingAddress
  });
  
  await fastlanePaymentComponent.render('#payment-container');
  console.log('Payment component rendered for returning customer');
  
  // Show submit button
  document.getElementById('submit-button').removeAttribute('hidden');
}

function setShippingAddressDisplay(shippingAddress) {
  const container = document.getElementById('shipping-display-container');
  const info = document.getElementById('shipping-info');
  
  info.innerHTML = `
    <p>${shippingAddress.name?.fullName || ''}</p>
    <p>${shippingAddress.address?.addressLine1 || ''}</p>
    <p>${shippingAddress.address?.adminArea2 || ''}, ${shippingAddress.address?.adminArea1 || ''} ${shippingAddress.address?.postalCode || ''}</p>
    <p>${shippingAddress.address?.countryCode || ''}</p>
  `;
  
  container.removeAttribute('hidden');
}
```

### Step 7: Render Payment Component for Guests

```javascript
async function renderFastlaneGuestExperience() {
  console.log('Rendering guest payment component');
  
  // Show card testing info for sandbox
  const cardTestingInfo = document.getElementById('card-testing-info');
  cardTestingInfo.removeAttribute('hidden');
  
  // CRITICAL: Render payment component for guest (no pre-filled data)
  fastlanePaymentComponent = await fastlane.FastlanePaymentComponent({
    options: {}
  });
  
  await fastlanePaymentComponent.render('#payment-container');
  console.log('Guest payment component rendered');
  
  // Show submit button
  document.getElementById('submit-button').removeAttribute('hidden');
}
```

---

## Checkout Flow

### Step 8: Handle Payment Submission

**CRITICAL CHANGES:**
1. Get token from already-rendered component (don't render again!)
2. Use `single_use_token` (snake_case), NOT `singleUseToken`
3. MUST send `PayPal-Request-Id` header
4. Use `Date.now().toString()` for request ID

```javascript
// Attach submit handler
document.getElementById('submit-button').addEventListener('click', handleSubmitOrder);

async function handleSubmitOrder() {
  try {
    console.log('Starting Fastlane checkout...');
    
    // CRITICAL: Ensure payment component is already rendered
    if (!fastlanePaymentComponent) {
      console.error('Payment component not initialized');
      alert('Please enter your email first');
      return;
    }
    
    // Get payment token from already-rendered component
    const { id: paymentToken } = await fastlanePaymentComponent.getPaymentToken();
    console.log('Payment token obtained:', paymentToken);
    
    // Build order payload
    const orderPayload = {
      intent: 'CAPTURE',
      purchase_units: [{
        amount: {
          currency_code: 'USD',
          value: '100.00',
          breakdown: {
            item_total: {
              currency_code: 'USD',
              value: '100.00'
            }
          }
        }
      }],
      payment_source: {
        card: {
          single_use_token: paymentToken // CRITICAL: snake_case, not camelCase!
        }
      }
    };
    
    // Add shipping if available
    if (customerProfileData?.shippingAddress) {
      orderPayload.purchase_units[0].shipping = {
        name: {
          full_name: customerProfileData.shippingAddress.name?.fullName || 'Guest'
        },
        address: {
          address_line_1: customerProfileData.shippingAddress.address?.addressLine1,
          admin_area_2: customerProfileData.shippingAddress.address?.adminArea2,
          admin_area_1: customerProfileData.shippingAddress.address?.adminArea1,
          postal_code: customerProfileData.shippingAddress.address?.postalCode,
          country_code: customerProfileData.shippingAddress.address?.countryCode || 'US'
        }
      };
    }
    
    // CRITICAL: Generate PayPal-Request-Id
    const paypalRequestId = Date.now().toString();
    console.log('Sending PayPal-Request-Id:', paypalRequestId);
    
    console.log('Creating order with payload:', orderPayload);
    
    // Create order with REQUIRED headers
    const orderResponse = await fetch('/paypal-api/checkout/orders/create', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'PayPal-Request-Id': paypalRequestId // CRITICAL: REQUIRED!
      },
      body: JSON.stringify(orderPayload)
    });
    
    if (!orderResponse.ok) {
      const errorData = await orderResponse.json();
      console.error('Order creation failed:', errorData);
      throw new Error('Order creation failed: ' + orderResponse.status);
    }
    
    const orderData = await orderResponse.json();
    console.log('Order created:', orderData.id);
    
    // Check if order was captured automatically
    if (orderData.status === 'COMPLETED') {
      console.log('Payment successful!');
      window.location.href = '/success?order=' + orderData.id;
    } else if (orderData.status === 'APPROVED') {
      // Capture the order if needed
      const captureResponse = await fetch(
        `/paypal-api/checkout/orders/${orderData.id}/capture`, 
        { method: 'POST' }
      );
      const captureData = await captureResponse.json();
      
      if (captureData.status === 'COMPLETED') {
        console.log('Payment captured successfully!');
        window.location.href = '/success?order=' + captureData.id;
      } else {
        alert('Payment could not be completed. Please try again.');
      }
    } else {
      alert('Order status: ' + orderData.status + '. Please contact support.');
    }
    
  } catch (error) {
    console.error('Checkout error:', error);
    alert('An error occurred during checkout: ' + error.message);
  }
}
```

---

## Server-Side Implementation

### Backend Order Creation Endpoint

**CRITICAL CHANGES:**
1. Read `paypal-request-id` header (Express lowercases ALL headers!)
2. Generate fallback UUID if header missing
3. Forward header to PayPal API
4. Add comprehensive logging

```javascript
// Node.js/Express - Create order with Fastlane single-use token
app.post('/paypal-api/checkout/orders/create', async (req, res) => {
  try {
    console.log('Order creation request:', JSON.stringify(req.body, null, 2));
    console.log('Request headers:', req.headers); // Debug: see all headers
    
    // Get access token
    const auth = Buffer.from(
      `${process.env.PAYPAL_CLIENT_ID}:${process.env.PAYPAL_CLIENT_SECRET}`
    ).toString('base64');
    
    const tokenResponse = await fetch(
      'https://api-m.sandbox.paypal.com/v1/oauth2/token',
      {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${auth}`,
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: 'grant_type=client_credentials'
      }
    );
    
    const { access_token } = await tokenResponse.json();
    
    // CRITICAL: Read PayPal-Request-Id (Express lowercases header names!)
    const paypalRequestId = req.headers['paypal-request-id'] || crypto.randomUUID();
    console.log('Using PayPal-Request-Id:', paypalRequestId);
    
    // Create order with single-use token from Fastlane
    const orderResponse = await fetch(
      'https://api-m.sandbox.paypal.com/v2/checkout/orders',
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${access_token}`,
          'Content-Type': 'application/json',
          'PayPal-Request-Id': paypalRequestId // CRITICAL: Must include!
        },
        body: JSON.stringify(req.body) // Forward entire payload
      }
    );
    
    const orderData = await orderResponse.json();
    
    if (!orderResponse.ok) {
      console.error('PayPal API Error Response:', JSON.stringify(orderData, null, 2));
      return res.status(orderResponse.status).json(orderData);
    }
    
    console.log('Order created:', orderData.id);
    res.json(orderData);
    
  } catch (error) {
    console.error('Server error creating order:', error);
    res.status(500).json({ error: { message: error.message } });
  }
});

// Capture order endpoint
app.post('/paypal-api/checkout/orders/:orderId/capture', async (req, res) => {
  const { orderId } = req.params;
  
  try {
    console.log('Capturing order:', orderId);
    
    // Get access token
    const auth = Buffer.from(
      `${process.env.PAYPAL_CLIENT_ID}:${process.env.PAYPAL_CLIENT_SECRET}`
    ).toString('base64');
    
    const tokenResponse = await fetch(
      'https://api-m.sandbox.paypal.com/v1/oauth2/token',
      {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${auth}`,
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: 'grant_type=client_credentials'
      }
    );
    
    const { access_token } = await tokenResponse.json();
    
    // Capture the order
    const captureResponse = await fetch(
      `https://api-m.sandbox.paypal.com/v2/checkout/orders/${orderId}/capture`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${access_token}`,
          'Content-Type': 'application/json'
        }
      }
    );
    
    const captureData = await captureResponse.json();
    
    if (!captureResponse.ok) {
      console.error('Order capture failed:', captureData);
      return res.status(captureResponse.status).json(captureData);
    }
    
    console.log('Order captured:', captureData.id);
    res.json(captureData);
    
  } catch (error) {
    console.error('Server error capturing order:', error);
    res.status(500).json({ error: { message: error.message } });
  }
});
```

---

## Common Errors & Solutions

### Error 1: "could not find container to render FastlaneWatermarkComponent"

**Cause:** Missing HTML container elements

**Solution:** Add these containers to your HTML:

```html
<div id="watermark-container"></div>
<div id="payment-container"></div>
```

---

### Error 2: "PAYPAL_REQUEST_ID_REQUIRED"

**Full Error:**

```json
{
  "name": "INVALID_REQUEST",
  "details": [{
    "issue": "PAYPAL_REQUEST_ID_REQUIRED",
    "description": "A PayPal-Request-Id is required if you are trying to process payment for an Order"
  }]
}
```

**Causes:**
1. Not sending PayPal-Request-Id header from frontend
2. CORS not allowing the header
3. Backend not reading/forwarding the header

**Solutions:**

**Frontend:**

```javascript
headers: {
  'Content-Type': 'application/json',
  'PayPal-Request-Id': Date.now().toString() // Add this
}
```

**Backend CORS:**

```javascript
res.header("Access-Control-Allow-Headers", "Content-Type, Authorization, PayPal-Request-Id");
```

**Backend Endpoint:**

```javascript
// Read header (lowercase in Express!)
const paypalRequestId = req.headers['paypal-request-id'] || crypto.randomUUID();

// Forward to PayPal
headers: {
  'PayPal-Request-Id': paypalRequestId
}
```

---

### Error 3: "showShippingAddressSelector failed"

**Cause:** Called without proper authentication context

**Wrong Approach:**

```javascript
// WRONG: Calling directly on button click
const shippingAddress = await fastlane.profile.showShippingAddressSelector();
```

**Correct Approach:**

```javascript
// CORRECT: Get from authentication response
const authResponse = await fastlane.identity.triggerAuthenticationFlow(customerContextId);
if (authResponse.authenticationState === 'succeeded') {
  const profileData = authResponse.profileData; // Get profile here!
  // profileData.shippingAddress is now available
}
```

---

### Error 4: "Payment component not initialized"

**Cause:** Trying to get token before rendering component

**Wrong Flow:**

```javascript
// WRONG: Render on button click
button.addEventListener('click', async () => {
  const component = await fastlane.FastlanePaymentComponent({...});
  await component.render('#payment-container');
  const token = await component.getPaymentToken();
});
```

**Correct Flow:**

```javascript
// CORRECT: Render on email blur, get token on button click

// Step 1: On email blur - render component
emailInput.addEventListener('blur', async () => {
  // ... authentication logic ...
  fastlanePaymentComponent = await fastlane.FastlanePaymentComponent({...});
  await fastlanePaymentComponent.render('#payment-container');
});

// Step 2: On button click - get token from already-rendered component
button.addEventListener('click', async () => {
  const { id: token } = await fastlanePaymentComponent.getPaymentToken();
});
```

---

## Best Practices

1. **Always Log Authentication States** - Helps debug member vs guest flows
2. **Handle All Auth States** - succeeded, failed, canceled, unexpected
3. **Render Component After Authentication** - Don't wait for checkout button click
4. **Store References Globally** - Component and profile data needed in multiple functions
5. **Use snake_case for PayPal Fields** - `single_use_token` not `singleUseToken`
6. **Generate Proper Request IDs** - Use `Date.now().toString()` or `crypto.randomUUID()`
7. **Add Comprehensive Logging** - Frontend and backend
8. **Test Both Flows** - New customer and returning customer paths
9. **Provide Graceful Fallbacks** - Always have guest experience as backup
10. **Check CORS Headers** - Must explicitly allow PayPal-Request-Id

---

## Key Differences: v4 vs v6 Fastlane

| Feature | v4 checkout.js | v6 Fastlane SDK |
|---------|----------------|-----------------|
| **SDK Loading** | `<script src="...checkout.js">` | `https://www.sandbox.paypal.com/web-sdk/v6/core` |
| **Authentication** | Client ID in frontend | Client token from backend |
| **Components** | Not required | Must specify `['fastlane']` |
| **Request ID** | Not required | **REQUIRED** for Fastlane orders |
| **Payment Creation** | Client-side | Server-side only |
| **CORS Headers** | Standard | Must allow PayPal-Request-Id |
| **API Version** | v1 Payments API | v2 Orders API |
| **Error Handling** | Simple callbacks | Comprehensive state management |

---

## Additional Resources

- [Official v6 Fastlane Documentation](https://docs.paypal.ai/payments/methods/cards/fastlane)
- [v6 SDK Documentation](https://docs.paypal.ai/payments)
- [PayPal Orders API v2](https://developer.paypal.com/docs/api/orders/v2/)
- [Sandbox Card Testing](https://developer.paypal.com/tools/sandbox/card-testing/)
- [v4 Archive Documentation](https://developer.paypal.com/docs/archive/checkout/how-to/customize-button/)

---

**Last Updated:** November 2024  
**Version:** 2.0 - Complete with all debugging solutions  
**Status:** Production-ready

