# PayPal checkout.js v4 Venmo to v6 - Migration Guide

**Official Documentation**:  
- v4 Archive: https://developer.paypal.com/docs/archive/  
- v6 Venmo: https://docs.paypal.ai/payments/methods/venmo/  
- v6 Checkout: https://docs.paypal.ai/payments/methods/paypal/sdk/js/v6/paypal-checkout

## Overview

Venmo is a US-only, mobile-first payment method. This guide shows how to migrate v4 Venmo integration to v6.

### Critical Requirements
- **US merchant account only**
- **USD currency only**
- **US-based customers only**
- **Eligibility check required in v6**
- **Always provide PayPal as fallback**

## v4 Venmo Integration (Before Migration)

### v4 HTML & JavaScript

```html
<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>Venmo Checkout v4</title>
</head>
<body>
  <h1>Pay with Venmo</h1>
  
  <!-- Venmo button container -->
  <div id="venmo-button-container"></div>
  
  <!-- Load PayPal checkout.js v4 SDK -->
  <script src="https://www.paypalobjects.com/api/checkout.js"></script>
  
  <script>
    // v4 Venmo Integration
    paypal.Button.render({
        env: 'sandbox',
        
        client: {
            sandbox: 'YOUR_SANDBOX_CLIENT_ID',
            production: 'YOUR_PRODUCTION_CLIENT_ID'
        },
        
        commit: true,
        
        // Style configuration for Venmo
        style: {
            label: 'pay',  // Generic "pay" label
            size: 'medium',
            shape: 'rect',
            color: 'blue',  // Venmo blue color
            layout: 'horizontal'
        },
        
        // Enable Venmo funding
        funding: {
            allowed: [paypal.FUNDING.VENMO],
            disallowed: []
        },
        
        // Create payment
        payment: function(data, actions) {
            return actions.payment.create({
                payment: {
                    transactions: [{
                        amount: {
                            total: '99.99',
                            currency: 'USD'
                        },
                        description: 'Premium Product Purchase'
                    }]
                }
            });
        },
        
        // Execute payment after approval
        onAuthorize: function(data, actions) {
            return actions.payment.execute().then(function(payment) {
                console.log('Venmo payment completed:', payment);
                window.location.href = `/success.html?paymentId=${payment.id}&PayerID=${data.payerID}`;
            });
        },
        
        onCancel: function(data) {
            console.log('Venmo payment cancelled:', data);
            alert('Payment was cancelled');
        },
        
        onError: function(err) {
            console.error('Venmo payment error:', err);
            alert('An error occurred during payment');
        }
        
    }, '#venmo-button-container');
  </script>
</body>
</html>
```

## v6 Venmo Integration (After Migration)

### v6 HTML

```html
<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>Venmo Checkout v6</title>
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
    
    .payment-button {
      margin-bottom: 12px;
    }
  </style>
</head>
<body>
  <h1>Pay with Venmo or PayPal</h1>
  
  <div id="loading" class="loading">
    <p>Loading payment options...</p>
  </div>
  
  <div class="buttons-container">
    <!-- Venmo button - hidden until eligibility confirmed -->
    <venmo-button 
      id="venmo-button" 
      class="payment-button" 
      hidden>
    </venmo-button>
    
    <!-- PayPal button - ALWAYS show as fallback -->
    <paypal-button 
      id="paypal-button" 
      type="pay" 
      class="payment-button" 
      hidden>
    </paypal-button>
  </div>
  
  <script src="app-v6.js"></script>
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
// app-v6.js - Venmo v6 Integration

/**
 * Fetch browser-safe client token from server
 */
async function getBrowserSafeClientToken() {
  const response = await fetch('/paypal-api/auth/browser-safe-client-token');
  const contentType = response.headers.get('content-type');
  
  if (!contentType?.includes('application/json')) {
    throw new Error('Expected JSON response');
  }
  
  const { accessToken } = await response.json();
  return accessToken;
}

/**
 * Create order on server (same for both Venmo and PayPal)
 */
async function createOrder() {
  const response = await fetch('/paypal-api/checkout/orders/create', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      amount: '99.99',
      currency: 'USD',  // MUST be USD for Venmo
      description: 'Premium Product Purchase'
    })
  });
  
  if (!response.ok) {
    throw new Error(`Order creation failed: ${response.status}`);
  }
  
  const { id } = await response.json();
  
  // CRITICAL: v6 requires this exact structure
  return { orderId: id };
}

/**
 * Capture order on server
 */
async function captureOrder({ orderId }) {
  const response = await fetch(
    `/paypal-api/checkout/orders/${orderId}/capture`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }
  );
  
  if (!response.ok) {
    throw new Error(`Capture failed: ${response.status}`);
  }
  
  return await response.json();
}

/**
 * Shared payment session options for both Venmo and PayPal
 */
const paymentSessionOptions = {
  /**
   * CRITICAL: onApprove MUST return Promise<void>
   */
  async onApprove(data) {
    console.log('Payment approved:', data.orderId);
    try {
      await captureOrder({ orderId: data.orderId });
      window.location.href = `/success.html?orderId=${data.orderId}`;
    } catch (error) {
      console.error('Payment capture failed:', error);
      alert('Payment processing failed. Please contact support.');
    }
  },
  
  /**
   * CRITICAL: onCancel takes NO parameters
   */
  onCancel() {
    console.log('Payment cancelled by user');
    alert('Payment was cancelled. Your items are still in your cart.');
  },
  
  /**
   * onError receives Error object only
   */
  onError(error) {
    console.error('Payment error:', error);
    const debugId = error.details?.debug_id || error.debug_id;
    const message = debugId 
      ? `Payment failed. Reference: ${debugId}` 
      : 'Payment failed. Please try again.';
    alert(message);
  }
};

/**
 * Setup Venmo button (only if eligible)
 */
async function setupVenmoButton(sdkInstance) {
  // Create Venmo payment session
  const venmoSession = sdkInstance.createVenmoOneTimePaymentSession(
    paymentSessionOptions
  );
  
  // Get button element
  const button = document.querySelector('#venmo-button');
  button.removeAttribute('hidden');
  
  // Add click handler
  button.addEventListener('click', async () => {
    try {
      console.log('Starting Venmo payment flow...');
      
      // Use 'auto' presentation mode for best mobile experience
      await venmoSession.start(
        { presentationMode: 'auto' },
        createOrder()
      );
      
    } catch (error) {
      console.error('Venmo payment start failed:', error);
      alert('Failed to start Venmo payment. Please try again.');
    }
  });
  
  console.log('Venmo button ready');
}

/**
 * Setup PayPal button (ALWAYS show as fallback)
 */
async function setupPayPalButton(sdkInstance) {
  const paypalSession = sdkInstance.createPayPalOneTimePaymentSession(
    paymentSessionOptions
  );
  
  const button = document.querySelector('#paypal-button');
  button.removeAttribute('hidden');
  
  button.addEventListener('click', async () => {
    try {
      await paypalSession.start(
        { presentationMode: 'auto' },
        createOrder()
      );
    } catch (error) {
      console.error('PayPal payment start failed:', error);
      alert('Failed to start PayPal payment. Please try again.');
    }
  });
  
  console.log('PayPal button ready');
}

/**
 * Called when PayPal v6 SDK finishes loading
 */
async function onPayPalWebSdkLoaded() {
  try {
    console.log('PayPal v6 SDK loaded');
    
    // Step 1: Get client token
    const clientToken = await getBrowserSafeClientToken();
    console.log('Client token received');
    
    // Step 2: Initialize SDK with BOTH paypal-payments AND venmo-payments
    const sdkInstance = await window.paypal.createInstance({
      clientToken,
      components: ["paypal-payments", "venmo-payments"], // Include both
      pageType: "checkout",
      locale: "en-US"
    });
    console.log('SDK initialized');
    
    // Step 3: CRITICAL - Check eligibility for both payment methods
    const eligibleMethods = await sdkInstance.findEligibleMethods({
      currencyCode: "USD",  // MUST be USD for Venmo
      countryCode: "US"     // MUST be US for Venmo
    });
    console.log('Eligibility checked');
    
    // Step 4: Setup Venmo button ONLY if eligible
    if (eligibleMethods.isEligible("venmo")) {
      console.log('Venmo is eligible, setting up button...');
      await setupVenmoButton(sdkInstance);
    } else {
      console.warn('Venmo not eligible (requires US buyer + USD currency)');
      // Hide Venmo button or show message
      document.querySelector('#venmo-button')?.remove();
    }
    
    // Step 5: ALWAYS setup PayPal as fallback
    if (eligibleMethods.isEligible("paypal")) {
      console.log('PayPal is eligible, setting up button...');
      await setupPayPalButton(sdkInstance);
    }
    
    // Hide loading indicator
    document.getElementById('loading').style.display = 'none';
    console.log('Payment buttons ready');
    
  } catch (error) {
    console.error('SDK initialization failed:', error);
    document.getElementById('loading').innerHTML = 
      '<p style="color: red;">Failed to initialize payment system. Please refresh the page.</p>';
  }
}

// Make function globally available for SDK callback
window.onPayPalWebSdkLoaded = onPayPalWebSdkLoaded;
```

## Key Migration Differences

| Aspect | v4 | v6 |
|--------|----|----|
| **SDK Components** | N/A | Must include `"venmo-payments"` |
| **Eligibility Check** | Not required | **MUST** check with `findEligibleMethods()` |
| **Funding Config** | `funding: { allowed: [VENMO] }` | Removed - use eligibility |
| **Button Style** | `style: { label: 'pay', color: 'blue' }` | Web component with CSS |
| **Session Type** | Same as PayPal | `createVenmoOneTimePaymentSession()` |
| **Fallback** | Optional | **MUST** provide PayPal fallback |
| **Presentation Mode** | N/A | Use `'auto'` for mobile optimization |

## Critical v6 Requirements

### 1. Include venmo-payments Component

```javascript
// CRITICAL: Must include venmo-payments component
const sdkInstance = await window.paypal.createInstance({
  clientToken,
  components: ["paypal-payments", "venmo-payments"], // Both required
  pageType: "checkout"
});
```

### 2. Check Venmo Eligibility

```javascript
// CRITICAL: Must check eligibility before showing Venmo
const eligibleMethods = await sdkInstance.findEligibleMethods({
  currencyCode: "USD",  // MUST be USD
  countryCode: "US"     // MUST be US
});

if (eligibleMethods.isEligible("venmo")) {
  // Setup Venmo button
} else {
  // Hide or remove Venmo button
}
```

### 3. Always Provide PayPal Fallback

```javascript
// CRITICAL: Always show PayPal as fallback
if (eligibleMethods.isEligible("paypal")) {
  await setupPayPalButton(sdkInstance);
}
```

## Testing Checklist

- [ ] Test with US merchant account
- [ ] Test with USD currency
- [ ] Test eligibility check with US buyer (should pass)
- [ ] Test eligibility check with non-US buyer (should fail)
- [ ] Test with USD currency (should pass)
- [ ] Test with non-USD currency (should fail)
- [ ] Test on mobile devices (iOS and Android)
- [ ] Test on desktop browsers
- [ ] Verify Venmo button hidden when not eligible
- [ ] Verify PayPal button always shows as fallback
- [ ] Test presentation mode 'auto' on mobile
- [ ] Test complete payment flow with Venmo
- [ ] Test fallback to PayPal when Venmo unavailable

## Common Issues

### Issue: Venmo button not appearing
**Cause**: Eligibility check failing  
**Solution**: Ensure US merchant, USD currency, US buyer location

### Issue: Venmo not eligible in sandbox
**Cause**: Test buyer not set to US  
**Solution**: Set `testBuyerCountry: 'US'` in SDK config

### Issue: Venmo payment fails on desktop
**Cause**: Venmo is mobile-first  
**Solution**: Use `presentationMode: 'auto'` and provide PayPal fallback

## Migration Benefits

- **Better Eligibility Detection**: Know when Venmo is truly available
- **Improved Mobile Experience**: `presentationMode: 'auto'` optimizes for mobile
- **Clear Fallback Pattern**: Always show PayPal as alternative
- **Better Error Handling**: Comprehensive error codes with Debug IDs
- **Enhanced Security**: Server-side validation required

## References

- **v4 Archive**: https://developer.paypal.com/docs/archive/
- **v6 Venmo Docs**: https://docs.paypal.ai/payments/methods/venmo/
- **v6 Checkout**: https://docs.paypal.ai/payments/methods/paypal/sdk/js/v6/paypal-checkout
- **TypeScript Types**: https://github.com/paypal/paypal-js/tree/main/packages/paypal-js/types/v6

