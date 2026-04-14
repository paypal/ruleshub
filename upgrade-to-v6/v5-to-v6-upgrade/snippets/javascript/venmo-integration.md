````markdown
# Venmo Integration (Client-Side)

## v6 Venmo Payment Implementation

### HTML Structure

```html
<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Venmo Payment Integration</title>
</head>
<body>
  <h1>Venmo Checkout</h1>
  
  <div id="loading" class="loading">
    <p>Checking payment options...</p>
  </div>
  
  <div class="buttons-container">
    <!-- Venmo button - hidden initially until eligibility confirmed -->
    <div id="venmo-method" class="payment-method">
      <venmo-button 
        id="venmo-button" 
        class="venmo-button">
      </venmo-button>
      <div class="venmo-note">
        US customers only • Requires Venmo app (mobile) or account (web)
      </div>
    </div>
    
    <!-- PayPal fallback - always available -->
    <div id="paypal-method" class="payment-method">
      <paypal-button 
        id="paypal-button" 
        type="pay" 
        class="paypal-gold">
      </paypal-button>
      <div class="venmo-note">
        Available worldwide • No app required
      </div>
    </div>
  </div>
  
  <script src="venmo-app.js"></script>
  
  <!-- Load PayPal v6 SDK with Venmo support -->
  <script 
    async 
    src="https://www.sandbox.paypal.com/web-sdk/v6/core" 
    onload="onPayPalWebSdkLoaded()">
  </script>
</body>
</html>
```

### JavaScript Implementation

```javascript
// venmo-app.js

/**
 * Main SDK initialization function
 */
async function onPayPalWebSdkLoaded() {
  try {
    console.log('PayPal v6 SDK loaded, initializing...');
    
    // Step 1: Get client token from server
    const clientToken = await getBrowserSafeClientToken();
    console.log('Client token retrieved');
    
    // Step 2: Initialize SDK with Venmo support
    const sdkInstance = await window.paypal.createInstance({
      clientToken,
      components: ["paypal-payments", "venmo-payments"], // Include venmo-payments
      pageType: "checkout"
    });
    console.log('SDK initialized with Venmo support');
    
    // Step 3: Check eligibility for US/USD specifically
    const eligibleMethods = await sdkInstance.findEligibleMethods({
      currencyCode: "USD",
      countryCode: "US" // Venmo requires US customers
    });
    console.log('Eligibility checked');
    
    // Step 4: Setup payment methods based on eligibility
    if (eligibleMethods.isEligible("venmo")) {
      console.log('Venmo is eligible - setting up Venmo button');
      await setupVenmoButton(sdkInstance);
      showPaymentMethod('venmo');
    } else {
      console.log('Venmo not eligible - showing reason and PayPal fallback');
      logVenmoIneligibilityReason(eligibleMethods);
      showVenmoUnavailableMessage();
    }
    
    // Always setup PayPal as fallback
    if (eligibleMethods.isEligible("paypal")) {
      console.log('Setting up PayPal fallback');
      await setupPayPalButton(sdkInstance);
      showPaymentMethod('paypal');
    }
    
    hideLoading();
    
  } catch (error) {
    console.error('SDK initialization failed:', error);
    showError('Failed to initialize payment options. Please refresh the page.');
    // Always show PayPal as ultimate fallback
    showPaymentMethod('paypal');
    hideLoading();
  }
}

/**
 * Setup Venmo payment button and session
 */
async function setupVenmoButton(sdkInstance) {
  // Create Venmo payment session with callbacks
  const venmoPaymentSession = sdkInstance.createVenmoOneTimePaymentSession({
    onApprove: handleVenmoApprove,
    onCancel: handleVenmoCancel,
    onError: handleVenmoError
  });
  
  // Get button element
  const venmoButton = document.querySelector('#venmo-button');
  
  // Add click handler to start Venmo payment flow
  venmoButton.addEventListener('click', async () => {
    try {
      console.log('Starting Venmo payment flow...');
      
      // Start payment with auto presentation mode (best for mobile)
      await venmoPaymentSession.start(
        { presentationMode: 'auto' }, // Handles app vs web flow automatically
        createOrder
      );
      
    } catch (error) {
      console.error('Venmo payment start failed:', error);
      
      // Handle specific Venmo errors
      if (error.code === 'VENMO_APP_NOT_INSTALLED') {
        showVenmoAppInstallPrompt();
      } else if (error.code === 'VENMO_NOT_AVAILABLE') {
        showVenmoUnavailableMessage();
        // Automatically show PayPal as fallback
        showPaymentMethod('paypal');
        hidePaymentMethod('venmo');
      } else {
        handleVenmoError(error);
      }
    }
  });
}

/**
 * Setup PayPal fallback button
 */
async function setupPayPalButton(sdkInstance) {
  const paypalPaymentSession = sdkInstance.createPayPalOneTimePaymentSession({
    onApprove: handlePaymentApprove,
    onCancel: handlePaymentCancel,
    onError: handlePaymentError
  });
  
  const paypalButton = document.querySelector('#paypal-button');
  
  paypalButton.addEventListener('click', async () => {
    try {
      console.log('Starting PayPal payment flow...');
      await paypalPaymentSession.start(
        { presentationMode: 'auto' },
        createOrder
      );
    } catch (error) {
      console.error('PayPal payment start failed:', error);
      handlePaymentError(error);
    }
  });
}

/**
 * Create order on server (same for both Venmo and PayPal)
 */
async function createOrder() {
  try {
    const response = await fetch('/paypal-api/checkout/orders/create', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        amount: '25.00',
        currency: 'USD',
        description: 'Purchase from Your Store'
      })
    });
    
    if (!response.ok) {
      throw new Error(`Order creation failed: ${response.status}`);
    }
    
    const { id } = await response.json();
    console.log('Order created:', id);
    
    return { orderId: id };
    
  } catch (error) {
    console.error('Order creation error:', error);
    throw error;
  }
}

/**
 * Handle Venmo payment approval
 * Same signature as PayPal onApprove
 */
async function handleVenmoApprove(data) {
  try {
    console.log('Venmo payment approved:', data.orderId);
    
    // Capture payment on server (same endpoint as PayPal)
    const response = await fetch(`/paypal-api/checkout/orders/${data.orderId}/capture`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      }
    });
    
    if (!response.ok) {
      throw new Error(`Capture failed: ${response.status}`);
    }
    
    const result = await response.json();
    console.log('Venmo payment captured:', result);

    // Show success message with Venmo branding
    showSuccessMessage('Payment completed with Venmo!');

    // Redirect to success page
    setTimeout(() => {
      window.location.href = '/success?orderId=' + data.orderId + '&method=venmo';
    }, 2000);
    
  } catch (error) {
    console.error('Venmo payment capture failed:', error);
    showError('Venmo payment processing failed. Please contact support.');
  }
}

/**
 * Handle Venmo payment cancellation
 */
function handleVenmoCancel() {
  console.log('Venmo payment cancelled by user');
  showInfo('Venmo payment was cancelled. You can try again or use PayPal instead.');
  
  // Highlight PayPal option
  highlightAlternativeMethod('paypal');
}

/**
 * Handle Venmo payment errors
 */
function handleVenmoError(error) {
  console.error('Venmo payment error:', error);
  
  const debugId = error.details?.debug_id || error.debug_id;
  
  let message = 'Venmo payment failed. ';
  
  switch (error.code) {
    case 'VENMO_NOT_AVAILABLE':
      message = 'Venmo is not available in your region. Please use PayPal instead.';
      showPaymentMethod('paypal');
      hidePaymentMethod('venmo');
      break;
      
    case 'VENMO_APP_NOT_INSTALLED':
      message = 'Venmo app is required for mobile payments. Install the app or use PayPal.';
      showVenmoAppInstallPrompt();
      break;
      
    case 'VENMO_ACCOUNT_REQUIRED':
      message = 'A Venmo account is required. Please sign up for Venmo or use PayPal.';
      showPaymentMethod('paypal');
      break;
      
    default:
      message += 'Please try again or use PayPal instead.';
      if (debugId) {
        message += ` Reference: ${debugId}`;
      }
  }
  
  showError(message);
  highlightAlternativeMethod('paypal');
}

/**
 * Get client token from server
 */
async function getBrowserSafeClientToken() {
  try {
    const response = await fetch('/paypal-api/auth/browser-safe-client-token');
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const { accessToken } = await response.json();
    return accessToken;
    
  } catch (error) {
    console.error('Failed to fetch client token:', error);
    throw new Error('Unable to initialize payment system');
  }
}

/**
 * UI Helper Functions
 */
function showPaymentMethod(method) {
  const element = document.getElementById(`${method}-method`);
  if (element) {
    element.classList.add('eligible');
  }
}

function hidePaymentMethod(method) {
  const element = document.getElementById(`${method}-method`);
  if (element) {
    element.classList.remove('eligible');
  }
}

function highlightAlternativeMethod(method) {
  const element = document.getElementById(`${method}-method`);
  if (element) {
    element.classList.add('highlighted');
  }
}

function hideLoading() {
  const loading = document.getElementById('loading');
  if (loading) loading.style.display = 'none';
}

function showError(message) {
  const errorDiv = document.createElement('div');
  errorDiv.className = 'error-message';
  errorDiv.innerHTML = `
    <div>
      Warning: ${message}
    </div>
  `;
  
  document.body.insertBefore(errorDiv, document.querySelector('.buttons-container'));
  
  // Auto-remove after 8 seconds
  setTimeout(() => errorDiv.remove(), 8000);
}

function showInfo(message) {
  const infoDiv = document.createElement('div');
  infoDiv.className = 'info-message';
  infoDiv.innerHTML = `
    <div>
      Info: ${message}
    </div>
  `;
  
  document.body.insertBefore(infoDiv, document.querySelector('.buttons-container'));
  
  // Auto-remove after 6 seconds
  setTimeout(() => infoDiv.remove(), 6000);
}

function showSuccessMessage(message) {
  const successDiv = document.createElement('div');
  successDiv.innerHTML = `
    <div>
      Success: ${message}
    </div>
  `;
  
  document.body.insertBefore(successDiv, document.querySelector('.buttons-container'));
}

function showVenmoAppInstallPrompt() {
  const promptDiv = document.createElement('div');
  promptDiv.innerHTML = `
    <div>
      App Required: <strong>Install Venmo App</strong><br>
      <a href="https://venmo.com/download" target="_blank">Download from App Store</a> or 
      <a href="https://play.google.com/store/apps/details?id=com.venmo" target="_blank">Google Play</a><br>
      <small>Or use PayPal instead (works in all browsers)</small>
    </div>
  `;
  
  document.body.insertBefore(promptDiv, document.querySelector('.buttons-container'));
}

function showVenmoUnavailableMessage() {
  showInfo('Venmo is only available for US customers with USD transactions. PayPal is available worldwide.');
}

function logVenmoIneligibilityReason(eligibleMethods) {
  console.log('Venmo eligibility details:', {
    venmoEligible: eligibleMethods.isEligible('venmo'),
    paypalEligible: eligibleMethods.isEligible('paypal'),
    // Note: Specific eligibility reasons may not be exposed by the API
    // This is for debugging purposes
  });
}

/**
 * Standard PayPal handlers (fallback)
 */
async function handlePaymentApprove(data) {
  try {
    console.log('PayPal payment approved:', data.orderId);
    
    const response = await fetch(`/paypal-api/checkout/orders/${data.orderId}/capture`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });
    
    if (!response.ok) {
      throw new Error(`Capture failed: ${response.status}`);
    }
    
    const result = await response.json();
    console.log('PayPal payment captured:', result);

    showSuccessMessage('Payment completed with PayPal!');

    setTimeout(() => {
      window.location.href = '/success?orderId=' + data.orderId + '&method=paypal';
    }, 2000);
    
  } catch (error) {
    console.error('PayPal payment capture failed:', error);
    showError('Payment processing failed. Please contact support.');
  }
}

function handlePaymentCancel() {
  console.log('PayPal payment cancelled');
  showInfo('Payment was cancelled. Your items are still in your cart.');
}

function handlePaymentError(error) {
  console.error('PayPal payment error:', error);
  const debugId = error.details?.debug_id || error.debug_id;
  let message = 'Payment failed. Please try again.';
  if (debugId) {
    message += ` Reference: ${debugId}`;
  }
  showError(message);
}

// Make function globally available
window.onPayPalWebSdkLoaded = onPayPalWebSdkLoaded;
```

### Device Detection and Optimization

```javascript
/**
 * Setup with device detection
 */
async function setupVenmoButtonWithDeviceOptimization(sdkInstance) {
  // Detect mobile device
  const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
  
  // Create Venmo session
  const venmoPaymentSession = sdkInstance.createVenmoOneTimePaymentSession({
    onApprove: handleVenmoApprove,
    onCancel: handleVenmoCancel,
    onError: handleVenmoError
  });
  
  const venmoButton = document.querySelector('#venmo-button');
  
  venmoButton.addEventListener('click', async () => {
    try {
      // Optimize presentation mode for device type
      const presentationMode = isMobile ? 'auto' : 'popup';
      
      await venmoPaymentSession.start(
        { presentationMode },
        createOrder
      );
      
    } catch (error) {
      // Handle device-specific fallbacks
      if (isMobile && error.code === 'VENMO_APP_NOT_INSTALLED') {
        // On mobile, offer app install or PayPal
        showMobileVenmoOptions();
      } else {
        handleVenmoError(error);
      }
    }
  });
}

function showMobileVenmoOptions() {
  const optionsDiv = document.createElement('div');
  optionsDiv.innerHTML = `
    <div>
      <h4>Choose your payment option:</h4>
      <div>
        <button onclick="installVenmoApp()">
          App Store: Install Venmo App
        </button>
        <button onclick="usePayPalInstead()">
          Web: Use PayPal
        </button>
      </div>
    </div>
  `;
  
  document.body.insertBefore(optionsDiv, document.querySelector('.buttons-container'));
}

function installVenmoApp() {
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
  const url = isIOS 
    ? 'https://apps.apple.com/us/app/venmo/id351727428'
    : 'https://play.google.com/store/apps/details?id=com.venmo';
  
  window.open(url, '_blank');
}

function usePayPalInstead() {
  hidePaymentMethod('venmo');
  showPaymentMethod('paypal');
  highlightAlternativeMethod('paypal');
  
  // Remove options div
  document.querySelector('.mobile-venmo-options')?.remove();
}
```

## Server-Side Implementation

### Required Endpoints

Venmo uses the **same server endpoints** as PayPal payments:

```javascript
// server.js - No changes needed for Venmo support

// Same endpoint for both Venmo and PayPal orders
app.post('/paypal-api/checkout/orders/create', async (req, res) => {
  // ... standard order creation logic
  // Works for both Venmo and PayPal payment sources
});

// Same endpoint for both Venmo and PayPal capture
app.post('/paypal-api/checkout/orders/:orderId/capture', async (req, res) => {
  // ... standard order capture logic
  // PayPal API handles Venmo vs PayPal automatically
});
```

## Migration from v5

### v5 Pattern

```javascript
// v5: Venmo via funding source
paypal.Buttons({
  fundingSource: paypal.FUNDING.VENMO,
  style: {
    color: 'blue'
  },
  createOrder: function(data, actions) {
    return actions.order.create({
      purchase_units: [{
        amount: { value: '10.00' }
      }]
    });
  },
  onApprove: function(data, actions) {
    return actions.order.capture();
  }
}).render('#venmo-button-container');
```

### v6 Pattern

```javascript
// v6: Dedicated Venmo payment session
const eligibleMethods = await sdkInstance.findEligibleMethods({
  currencyCode: "USD",
  countryCode: "US"
});

if (eligibleMethods.isEligible("venmo")) {
  const venmoSession = sdkInstance.createVenmoOneTimePaymentSession({
    onApprove: async (data) => {
      await captureOrder({ orderId: data.orderId });
    },
    onCancel: () => {
      console.log('Venmo cancelled');
    },
    onError: (error) => {
      handleVenmoError(error);
    }
  });
  
  button.addEventListener('click', () => {
    venmoSession.start({ presentationMode: 'auto' }, createOrder);
  });
}
```

## Best Practices

### 1. Always Check Eligibility
```javascript
// Always check eligibility first
const eligible = await sdkInstance.findEligibleMethods({
  currencyCode: "USD",
  countryCode: "US" // Required for Venmo
});

if (eligible.isEligible("venmo")) {
  setupVenmoButton();
} else {
  setupPayPalFallback();
}
```

### 2. Provide PayPal Fallback
```javascript
// Always offer PayPal as alternative
if (!eligibleMethods.isEligible("venmo")) {
  showInfo("Venmo not available. Using PayPal instead.");
  setupPayPalButton(sdkInstance);
}
```

### 3. Handle Regional Restrictions
```javascript
// Validate geographic requirements
if (customerCountry !== 'US' || currency !== 'USD') {
  console.log('Venmo not available outside US/USD');
  // Don't show Venmo option
}
```

### 4. Mobile App Detection
```javascript
// Handle app installation gracefully
venmoSession.start(config, createOrder).catch(error => {
  if (error.code === 'VENMO_APP_NOT_INSTALLED') {
    showAppInstallOptions();
  }
});
```

## Testing Checklist

- Test with US-based test accounts only
- Verify Venmo button only shows for USD transactions
- Test mobile app flow (if Venmo app installed)
- Test web flow (browser-based Venmo)
- Verify PayPal fallback when Venmo unavailable
- Test error handling for non-US customers
- Validate presentation mode 'auto' works correctly
- Test app installation prompts on mobile
- Verify order creation/capture work for both Venmo and PayPal
- Test cancellation flow for both payment methods

## Error Scenarios

- **Venmo not available**: Show PayPal fallback
- **App not installed**: Offer app download + PayPal option
- **Non-US customer**: Hide Venmo, show PayPal only
- **Non-USD currency**: Hide Venmo, show PayPal only
- **Network error**: Standard retry logic
- **Payment declined**: Suggest PayPal alternative

Remember: Venmo is essentially a PayPal payment method with additional eligibility requirements. The server-side implementation remains identical to standard PayPal integration.

## Official Documentation

- **Venmo Integration Guide**: [docs.paypal.ai/payments/methods/venmo/integrate](https://docs.paypal.ai/payments/methods/venmo/integrate)
- **PayPal v6 SDK Documentation**: [docs.paypal.ai/payments/methods/paypal/sdk/js/v6/paypal-checkout](https://docs.paypal.ai/payments/methods/paypal/sdk/js/v6/paypal-checkout)
- **Eligibility Methods**: [GitHub - find-eligible-methods.d.ts](https://github.com/paypal/paypal-js/blob/main/packages/paypal-js/types/v6/components/find-eligible-methods.d.ts)
````