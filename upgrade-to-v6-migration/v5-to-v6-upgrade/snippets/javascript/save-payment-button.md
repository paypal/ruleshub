# Save Payment Button Implementation

**Official Documentation**: https://docs.paypal.ai/payments/save/sdk/paypal/js-sdk-v6-vault

## Overview

This guide shows how to implement a save payment button using PayPal v6 SDK that allows customers to save their payment methods for future use without making a purchase.

## v5 vs v6 Comparison

### v5 Pattern (Deprecated)
```javascript
// v5: Global object with vault configuration
paypal.Buttons({
  vault: true,
  intent: 'tokenize',
  createOrder: function(data, actions) {
    return actions.order.create({
      intent: 'CAPTURE',
      purchase_units: [{
        amount: { value: '0.00', currency_code: 'USD' }
      }]
    });
  },
  onApprove: function(data, actions) {
    // Handle vault approval
    console.log('Vault ID:', data.vaultToken);
  }
}).render('#paypal-button');
```

### v6 Pattern (Current)
```javascript
// v6: Instance-based SDK with dedicated save payment session
const sdkInstance = await window.paypal.createInstance({
  clientToken: await getBrowserSafeClientToken(),
  components: ["paypal-payments"],
  pageType: "checkout"
});

const savePaymentSession = sdkInstance.createPayPalSavePaymentSession({
  onApprove: (data) => {
    console.log('Setup token approved:', data.setupToken);
    // Create payment token on server
    createPaymentTokenFromSetup(data.setupToken);
  },
  onCancel: () => {
    console.log('Save payment cancelled');
  },
  onError: (error) => {
    console.error('Save payment error:', error);
    handleSavePaymentError(error);
  }
});
```

## Complete Implementation

### 1. HTML Structure
```html
<!DOCTYPE html>
<html>
<head>
  <title>Save Payment Method</title>
</head>
<body>
  <div id="save-payment-container">
    <h2>Save Payment Method</h2>
    <p>Save your PayPal account for faster checkout in the future.</p>
    
    <button id="save-payment-button" class="paypal-save-button">
      Save PayPal Account
    </button>
    
    <div id="save-payment-status"></div>
  </div>

  <!-- v6 SDK Script -->
  <script async src="https://www.sandbox.paypal.com/web-sdk/v6/core" onload="onPayPalWebSdkLoaded()"></script>
</body>
</html>
```

### 2. Client-Side Implementation
```javascript
let sdkInstance = null;
let savePaymentSession = null;

// SDK Initialization
async function onPayPalWebSdkLoaded() {
  try {
    const clientToken = await getBrowserSafeClientToken();
    
    sdkInstance = await window.paypal.createInstance({
      clientToken: clientToken,
      components: ["paypal-payments"],
      pageType: "checkout"
    });

    await initializeSavePaymentButton();
    console.log('PayPal v6 SDK initialized for save payment');
  } catch (error) {
    console.error('SDK initialization failed:', error);
    showErrorMessage('Failed to initialize payment system');
  }
}

// Initialize Save Payment Session
async function initializeSavePaymentButton() {
  try {
    savePaymentSession = sdkInstance.createPayPalSavePaymentSession({
      onApprove: async (data) => {
        console.log('Save payment approved:', data);
        await handleSavePaymentApproval(data);
      },
      onCancel: () => {
        console.log('Save payment cancelled by user');
        showInfoMessage('Payment method saving was cancelled');
      },
      onError: (error) => {
        console.error('Save payment error:', error);
        handleSavePaymentError(error);
      }
    });

    setupSavePaymentButton();
  } catch (error) {
    console.error('Failed to create save payment session:', error);
    showErrorMessage('Failed to setup save payment functionality');
  }
}

// Setup Button Click Handler
function setupSavePaymentButton() {
  const button = document.getElementById('save-payment-button');
  
  button.addEventListener('click', async () => {
    try {
      button.disabled = true;
      button.textContent = 'Processing...';
      
      await savePaymentSession.start(
        { presentationMode: 'auto' },
        async () => {
          // Generate setup token from server
          const setupToken = await createSetupToken();
          return { setupToken: setupToken };
        }
      );
    } catch (error) {
      console.error('Failed to start save payment flow:', error);
      handleSavePaymentError(error);
    } finally {
      button.disabled = false;
      button.textContent = 'Save PayPal Account';
    }
  });
}

// Handle Save Payment Approval
async function handleSavePaymentApproval(data) {
  try {
    showInfoMessage('Creating payment method...');
    
    const response = await fetch('/paypal-api/vault/payment-token/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        setupToken: data.setupToken,
        customerId: getCurrentCustomerId() // Your customer ID
      })
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const result = await response.json();
    console.log('Payment token created:', result);
    
    showSuccessMessage('Payment method saved successfully!');
    
    // Optionally redirect or update UI
    setTimeout(() => {
      window.location.href = '/account/payment-methods';
    }, 2000);
    
  } catch (error) {
    console.error('Failed to create payment token:', error);
    showErrorMessage('Failed to save payment method. Please try again.');
  }
}

// Error Handler
function handleSavePaymentError(error) {
  console.error('Save payment error:', error);
  
  // Extract PayPal Debug ID if available
  const debugId = error?.details?.debug_id || error?.debugId || 'N/A';
  console.log('PayPal Debug ID:', debugId);
  
  let errorMessage = 'Failed to save payment method';
  
  if (error.name === 'VALIDATION_ERROR') {
    errorMessage = 'Invalid payment information. Please try again.';
  } else if (error.name === 'NETWORK_ERROR') {
    errorMessage = 'Network error. Please check your connection and try again.';
  }
  
  showErrorMessage(errorMessage);
}

// Client Token Generation
async function getBrowserSafeClientToken() {
  try {
    const response = await fetch('/paypal-api/auth/browser-safe-client-token');
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const data = await response.json();
    return data.clientToken;
  } catch (error) {
    console.error('Failed to get client token:', error);
    throw new Error('Authentication failed');
  }
}

// Setup Token Creation
async function createSetupToken() {
  try {
    const response = await fetch('/paypal-api/vault/setup-token/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        customerId: getCurrentCustomerId()
      })
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    return data.id;
  } catch (error) {
    console.error('Failed to create setup token:', error);
    throw new Error('Failed to initialize save payment');
  }
}

// Helper Functions
function getCurrentCustomerId() {
  // Return your customer ID - implement based on your auth system
  return 'customer_123'; // Replace with actual customer ID
}

function showSuccessMessage(message) {
  const statusDiv = document.getElementById('save-payment-status');
  statusDiv.innerHTML = `<div class="success-message">${message}</div>`;
}

function showErrorMessage(message) {
  const statusDiv = document.getElementById('save-payment-status');
  statusDiv.innerHTML = `<div class="error-message">${message}</div>`;
}

function showInfoMessage(message) {
  const statusDiv = document.getElementById('save-payment-status');
  statusDiv.innerHTML = `<div class="info-message">${message}</div>`;
}
```

## Server-Side Requirements

This implementation requires these server endpoints:

1. **GET /paypal-api/auth/browser-safe-client-token** - Generate client tokens
2. **POST /paypal-api/vault/setup-token/create** - Create setup tokens
3. **POST /paypal-api/vault/payment-token/create** - Create payment tokens from setup tokens

See the corresponding server-side snippet files for implementation details.

## Security Considerations

- **Never store setup tokens** - they are one-time use only
- **Always validate customer identity** before saving payment methods
- **Encrypt payment tokens** when storing in your database
- **Implement proper authentication** before allowing vault operations
- **Log all vault operations** for audit purposes
- **Provide clear consent mechanisms** for payment method saving

## Testing

Test with PayPal sandbox accounts:

1. Create sandbox business and personal accounts
2. Use sandbox client credentials
3. Test save payment flow
4. Verify payment token creation
5. Test error scenarios (network failures, invalid tokens)

## Common Issues

- **Missing vault permissions**: Ensure vault is enabled in PayPal Developer Dashboard
- **Invalid setup tokens**: Check server-side setup token creation
- **Customer authentication**: Verify customer is properly authenticated
- **Token expiration**: Implement proper error handling for expired tokens