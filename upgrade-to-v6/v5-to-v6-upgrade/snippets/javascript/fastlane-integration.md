# Fastlane Integration - v6 SDK

## Overview
Fastlane provides accelerated guest checkout by recognizing returning customers and pre-filling their payment and shipping information.

## HTML Setup

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Fastlane Checkout - v6 SDK</title>
  <!-- v6 SDK Core Script -->
  <script async src="https://www.sandbox.paypal.com/web-sdk/v6/core" onload="onPayPalLoaded()"></script>
</head>
<body>
  <h1>Checkout</h1>
  
  <!-- Email input for Fastlane lookup -->
  <div>
    <label for="email">Email:</label>
    <input type="email" id="email-input" placeholder="Enter your email">
    <button id="email-submit-button">Continue</button>
  </div>
  
  <!-- Payment component container -->
  <div id="fastlane-payment-component" style="display:none;"></div>
  
  <!-- Submit button -->
  <button id="pay-button" style="display:none;">Pay Now</button>
  
  <div id="result-message"></div>
</body>
</html>
```

## Client-Side JavaScript

```javascript
let sdkInstance;
let fastlane;
let paymentComponent;
let profileData = null;

// Called when v6 SDK loads
async function onPayPalLoaded() {
  try {
    // Step 1: Get client token from backend
    const tokenResponse = await fetch('/paypal-api/auth/browser-safe-client-token');
    const { accessToken } = await tokenResponse.json();
    
    // Step 2: Initialize v6 SDK with Fastlane component
    sdkInstance = await window.paypal.createInstance({
      clientToken: accessToken,
      pageType: 'product-details',
      clientMetadataId: crypto.randomUUID(),
      components: ['fastlane']
    });
    
    // Step 3: Create Fastlane instance
    fastlane = await sdkInstance.createFastlane();
    
    // Step 4: Set locale
    fastlane.setLocale('en_us');
    
    // Step 5: Set up email submit handler
    document.getElementById('email-submit-button').addEventListener('click', handleEmailSubmit);
    
    console.log('Fastlane initialized');
    
  } catch (error) {
    console.error('Fastlane initialization error:', error);
    document.getElementById('result-message').textContent = 
      'Failed to load checkout';
  }
}

// Handle email submission
async function handleEmailSubmit() {
  const emailInput = document.getElementById('email-input');
  const email = emailInput.value.trim();
  
  if (!email || !email.includes('@')) {
    alert('Enter a valid email address');
    return;
  }
  
  try {
    document.getElementById('email-submit-button').disabled = true;
    document.getElementById('email-submit-button').textContent = 'Checking...';
    
    // Step 1: Look up customer by email
    const { customerContextId } = await fastlane.identity.lookupCustomerByEmail(email);
    
    if (customerContextId) {
      // Customer recognized - trigger authentication
      console.log('Customer recognized, triggering authentication...');
      
      const { authenticationState, profileData: authProfileData } = 
        await fastlane.identity.triggerAuthenticationFlow(customerContextId);
      
      if (authenticationState === 'succeeded') {
        console.log('Authentication succeeded');
        profileData = authProfileData;
        
        // Pre-fill shipping address if available
        if (profileData.shippingAddress) {
          console.log('Pre-filling shipping address:', profileData.shippingAddress);
          // Pre-fill your shipping form here
        }
        
        // Show payment component with saved card
        await setupPaymentComponent();
        
      } else if (authenticationState === 'canceled') {
        console.log('Authentication canceled by user');
        // Show standard checkout
        await showStandardCheckout();
        
      } else if (authenticationState === 'failed') {
        console.error('Authentication failed');
        // Show standard checkout
        await showStandardCheckout();
      }
      
    } else {
      // New customer - show standard checkout
      console.log('New customer, showing standard checkout');
      await showStandardCheckout();
    }
    
  } catch (error) {
    console.error('Email lookup error:', error);
    alert('An error occurred');
    document.getElementById('email-submit-button').disabled = false;
    document.getElementById('email-submit-button').textContent = 'Continue';
  }
}

// Setup payment component
async function setupPaymentComponent() {
  try {
    // Create Fastlane payment component
    paymentComponent = await fastlane.FastlanePaymentComponent({
      styles: {
        root: {
          backgroundColor: '#ffffff',
          padding: '20px'
        }
      }
    });
    
    // Render payment component
    paymentComponent.render('#fastlane-payment-component');
    
    // Show payment section
    document.getElementById('fastlane-payment-component').style.display = 'block';
    document.getElementById('pay-button').style.display = 'block';
    
    // Set up pay button handler
    document.getElementById('pay-button').addEventListener('click', handlePayment);
    
    // Hide email section
    document.getElementById('email-input').disabled = true;
    document.getElementById('email-submit-button').style.display = 'none';
    
  } catch (error) {
    console.error('Payment component setup error:', error);
  }
}

// Show standard checkout (for new customers)
async function showStandardCheckout() {
  try {
    paymentComponent = await fastlane.FastlanePaymentComponent();
    paymentComponent.render('#fastlane-payment-component');
    
    document.getElementById('fastlane-payment-component').style.display = 'block';
    document.getElementById('pay-button').style.display = 'block';
    document.getElementById('pay-button').addEventListener('click', handlePayment);
    
    document.getElementById('email-input').disabled = true;
    document.getElementById('email-submit-button').style.display = 'none';
    
  } catch (error) {
    console.error('Standard checkout setup error:', error);
  }
}

// Handle payment
async function handlePayment() {
  const payButton = document.getElementById('pay-button');
  const resultMessage = document.getElementById('result-message');
  
  try {
    payButton.disabled = true;
    payButton.textContent = 'Processing...';
    
    // Step 1: Get payment token from component
    const { id: paymentToken } = await paymentComponent.getPaymentToken({
      billingAddress: {
        postalCode: '95131' // Optional
      }
    });
    
    console.log('Payment token obtained:', paymentToken);
    
    // Step 2: Create order with payment token
    const orderResponse = await fetch('/paypal-api/checkout/orders/create-fastlane', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        amount: '100.00',
        currency: 'USD',
        paymentToken: paymentToken,
        email: document.getElementById('email-input').value
      })
    });
    
    if (!orderResponse.ok) {
      throw new Error('Failed to create order');
    }
    
    const orderData = await orderResponse.json();
    console.log('Order created:', orderData.id);
    
    // Step 3: Capture order
    const captureResponse = await fetch(
      `/paypal-api/checkout/orders/${orderData.id}/capture`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      }
    );
    
    if (!captureResponse.ok) {
      throw new Error('Failed to capture order');
    }
    
    const captureData = await captureResponse.json();
    console.log('Order captured:', captureData);
    
    resultMessage.textContent = 'Payment complete';
    resultMessage.style.color = 'green';
    
    setTimeout(() => {
      window.location.href = '/success';
    }, 2000);
    
  } catch (error) {
    console.error('Payment error:', error);
    resultMessage.textContent = 'Payment failed';
    resultMessage.style.color = 'red';
    payButton.disabled = false;
    payButton.textContent = 'Pay Now';
  }
}
```

## Server-Side: Client Token Generation

```javascript
// Same as card fields - see card-fields-integration.md
app.get('/paypal-api/auth/browser-safe-client-token', async (req, res) => {
  try {
    const accessToken = await getAccessToken();
    
    const tokenResponse = await fetch(
      'https://api-m.sandbox.paypal.com/v1/identity/generate-token',
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({})
      }
    );
    
    const { client_token } = await tokenResponse.json();
    res.json({ accessToken: client_token });
    
  } catch (error) {
    console.error('Error generating client token:', error);
    res.status(500).json({ error: 'Failed to generate client token' });
  }
});
```

## Server-Side: Order Creation with Fastlane Token

```javascript
app.post('/paypal-api/checkout/orders/create-fastlane', express.json(), async (req, res) => {
  try {
    const { amount, currency, paymentToken, email } = req.body;
    const accessToken = await getAccessToken();
    
    // Create order with Fastlane single-use token
    const orderResponse = await fetch('https://api-m.sandbox.paypal.com/v2/checkout/orders', {
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
        }],
        payment_source: {
          card: {
            // Use singleUseToken from Fastlane
            singleUseToken: paymentToken,
            attributes: {
              verification: {
                method: 'SCA_WHEN_REQUIRED'
              }
            }
          }
        },
        payer: {
          email_address: email
        }
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

## Fastlane Flow Summary

1. **Email Collection**: User enters email
2. **Identity Lookup**: Check if email has saved profile
3. **Authentication** (if recognized): Trigger OTP/biometric auth
4. **Profile Pre-fill**: Pre-fill shipping and payment info
5. **Payment Component**: Render Fastlane payment component
6. **Get Payment Token**: Get single-use payment token
7. **Create Order**: Use token in `payment_source.card.singleUseToken`
8. **Capture Order**: Complete the transaction

## Profile Data Structure

```javascript
// profileData from successful authentication
{
  name: {
    fullName: "John Doe",
    firstName: "John",
    lastName: "Doe"
  },
  shippingAddress: {
    address: {
      addressLine1: "123 Main St",
      addressLine2: "Apt 4",
      adminArea1: "CA", // State
      adminArea2: "San Jose", // City
      postalCode: "95131",
      countryCode: "US"
    }
  },
  card: {
    id: "payment_token_id",
    paymentSource: {
      card: {
        brand: "VISA",
        lastDigits: "1111",
        expiry: "2025-12"
      }
    }
  }
}
```

## Fastlane vs Card Fields

**Fastlane:**
- Purpose: Guest checkout acceleration
- Profile Recognition: Yes
- Cross-Merchant: Yes
- Email Lookup: Yes
- Shipping Pre-fill: Yes
- Component: FastlanePaymentComponent

**Card Fields:**
- Purpose: Regular card payments
- Profile Recognition: No
- Cross-Merchant: No
- Email Lookup: No
- Shipping Pre-fill: No
- Component: CardFieldsComponent

## v5 to v6 Migration Changes

**Initialization:**
- v5: `window.paypal.Fastlane()`
- v6: `sdkInstance.createFastlane()`

**Component Name:**
- v5: FastlaneCardComponent
- v6: FastlanePaymentComponent

**Authentication:**
- v5: Client ID
- v6: Client token

**Order Field:**
- v5: `payment_source.token`
- v6: `payment_source.card.singleUseToken`

**Locale:**
- v5: Not required
- v6: Call `setLocale()`

## Important Notes

1. Component name: FastlanePaymentComponent (not FastlaneCardComponent)
2. Call setLocale() before using Fastlane
3. Use singleUseToken in order creation (not vault_id)
4. Client token required from backend
5. Email lookup before authentication
6. Authentication for recognized users only
7. Profile includes shipping information for pre-fill
8. Works across merchants

## Implementation Guidelines

- Implement email validation before lookup
- Handle both recognized and new customers
- Pre-fill shipping address from profileData
- Show loading states during authentication
- Implement fallback to standard checkout
- Use HTTPS in production
- Log authentication attempts
- Implement error handling

## Common Errors

**FastlaneCardComponent not defined** - Using v5 component name - Use FastlanePaymentComponent
**Locale not set** - Missing setLocale() call - Call fastlane.setLocale('en_us')
**window.paypal.Fastlane not a function** - Using v5 pattern - Use sdkInstance.createFastlane()

