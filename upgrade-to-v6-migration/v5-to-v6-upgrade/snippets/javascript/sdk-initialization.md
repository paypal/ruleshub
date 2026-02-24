# SDK Initialization (Client-Side)

## v6 SDK Initialization Pattern

### HTML Structure

```html
<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>PayPal v6 Integration</title>
</head>
<body>
  <h1>PayPal v6 Checkout</h1>
  
  <div id="loading" class="loading">
    <p>Loading payment options...</p>
  </div>
  
  <div id="error" class="error">
    <p id="error-message"></p>
  </div>
  
  <div class="buttons-container">
    <!-- PayPal button - hidden initially until SDK ready -->
    <paypal-button 
      id="paypal-button" 
      type="pay" 
      class="paypal-gold" 
      hidden>
    </paypal-button>
  </div>
  
  <!-- Load your application JavaScript first -->
  <script src="app.js"></script>
  
  <!-- Load PayPal v6 SDK asynchronously -->
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
// app.js

/**
 * Fetch browser-safe client token from server
 */
async function getBrowserSafeClientToken() {
  try {
    const response = await fetch('/paypal-api/auth/browser-safe-client-token');
    
    // Validate response is JSON (not HTML error page)
    const contentType = response.headers.get('content-type');
    if (!contentType || !contentType.includes('application/json')) {
      throw new Error('Server returned non-JSON response');
    }
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const { accessToken } = await response.json();
    
    if (!accessToken) {
      throw new Error('No access token in response');
    }
    
    return accessToken;
    
  } catch (error) {
    console.error('Failed to fetch client token:', error);
    throw new Error('Unable to initialize payment system. Please try again.');
  }
}

/**
 * Called when PayPal v6 SDK finishes loading
 * This is the main initialization function
 */
async function onPayPalWebSdkLoaded() {
  try {
    console.log('PayPal v6 SDK loaded');
    
    // Step 1: Get client token from server
    console.log('Fetching client token...');
    const clientToken = await getBrowserSafeClientToken();
    console.log('Client token received');

    // Step 2: Initialize SDK instance
    console.log('Initializing SDK...');
    const sdkInstance = await window.paypal.createInstance({
      clientToken,
      components: ["paypal-payments"], // Only load what you need
      pageType: "checkout", // Optional: helps PayPal optimize the experience
      locale: "en-US" // Optional: set language/locale
    });
    console.log('SDK initialized');

    // Step 3: Check payment method eligibility
    console.log('Checking payment eligibility...');
    const eligibleMethods = await sdkInstance.findEligibleMethods({
      currencyCode: "USD"
    });
    console.log('Eligibility checked');

    // Step 4: Setup available payment methods
    if (eligibleMethods.isEligible("paypal")) {
      console.log('PayPal is eligible, setting up button...');
      await setupPayPalButton(sdkInstance);
      console.log('PayPal button ready');
    } else {
      console.warn('PayPal not eligible for this transaction');
      showError('PayPal is not available for this transaction');
      return;
    }
    
    // Hide loading indicator
    hideLoading();
    
  } catch (error) {
    console.error('SDK initialization failed:', error);
    showError('Failed to initialize payment system. Please refresh the page.');
  }
}

/**
 * Setup PayPal payment button
 */
async function setupPayPalButton(sdkInstance) {
  // Create payment session with callbacks
  const paymentSession = sdkInstance.createPayPalOneTimePaymentSession({
    onApprove: handlePaymentApprove,
    onCancel: handlePaymentCancel,
    onError: handlePaymentError
  });
  
  // Get button element and show it
  const button = document.querySelector('#paypal-button');
  button.removeAttribute('hidden');
  
  // Add click handler to start payment flow
  button.addEventListener('click', async () => {
    try {
      console.log('Starting payment flow...');
      
      // Start payment with order creation
      await paymentSession.start(
        { presentationMode: 'auto' }, // Auto-select best presentation
        createOrder() // Function that creates order on server
      );
      
    } catch (error) {
      console.error('Payment start failed:', error);
      showError('Failed to start payment. Please try again.');
    }
  });
}

/**
 * Create order on server
 * Returns Promise that resolves to { orderId: string }
 */
async function createOrder() {
  try {
    const response = await fetch('/paypal-api/checkout/orders/create', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        amount: '10.00',
        currency: 'USD'
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
 * Handle successful payment approval
 * IMPORTANT: Must return Promise<void> in v6
 */
async function handlePaymentApprove(data) {
  try {
    console.log('Payment approved:', data.orderId);
    
    // Capture payment on server
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
    console.log('Payment captured:', result);

    // Redirect to success page
    window.location.href = '/success?orderId=' + data.orderId;
    
  } catch (error) {
    console.error('Payment capture failed:', error);
    showError('Payment processing failed. Please contact support.');
  }
}

/**
 * Handle payment cancellation
 * IMPORTANT: Takes NO parameters in v6
 */
function handlePaymentCancel() {
  console.log('Payment cancelled by user');
  showError('Payment was cancelled. Your items are still in your cart.');
}

/**
 * Handle payment errors
 * Receives Error object
 */
function handlePaymentError(error) {
  console.error('Payment error:', error);
  
  // Extract debug ID if available
  const debugId = error.details?.debug_id || error.debug_id;
  
  let message = 'Payment failed. Please try again.';
  if (debugId) {
    message += ` Reference: ${debugId}`;
  }
  
  showError(message);
}

/**
 * UI Helper Functions
 */
function hideLoading() {
  const loading = document.getElementById('loading');
  if (loading) loading.style.display = 'none';
}

function showError(message) {
  hideLoading();
  const errorDiv = document.getElementById('error');
  const errorMessage = document.getElementById('error-message');
  
  if (errorDiv && errorMessage) {
    errorMessage.textContent = message;
    errorDiv.style.display = 'block';
  }
}

// Make function globally available for SDK onload callback
window.onPayPalWebSdkLoaded = onPayPalWebSdkLoaded;
```

### TypeScript Implementation

```typescript
// app.ts
import type {
  PayPalV6Namespace,
  SdkInstance,
  PayPalOneTimePaymentSessionOptions,
  OnApproveDataOneTimePayments
} from "@paypal/paypal-js/sdk-v6";

declare global {
  interface Window {
    paypal: PayPalV6Namespace;
  }
}

async function getBrowserSafeClientToken(): Promise<string> {
  const response = await fetch('/paypal-api/auth/browser-safe-client-token');
  
  const contentType = response.headers.get('content-type');
  if (!contentType?.includes('application/json')) {
    throw new Error('Server returned non-JSON response');
  }
  
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }
  
  const { accessToken }: { accessToken: string } = await response.json();
  return accessToken;
}

async function onPayPalWebSdkLoaded(): Promise<void> {
  try {
    const clientToken = await getBrowserSafeClientToken();
    
    const sdkInstance: SdkInstance<["paypal-payments"]> = 
      await window.paypal.createInstance({
        clientToken,
        components: ["paypal-payments"],
        pageType: "checkout"
      });
    
    const eligibleMethods = await sdkInstance.findEligibleMethods({
      currencyCode: "USD"
    });
    
    if (eligibleMethods.isEligible("paypal")) {
      await setupPayPalButton(sdkInstance);
    }
    
    hideLoading();
    
  } catch (error) {
    console.error('SDK initialization failed:', error);
    showError('Failed to initialize payment system');
  }
}

async function setupPayPalButton(
  sdkInstance: SdkInstance<["paypal-payments"]>
): Promise<void> {
  const options: PayPalOneTimePaymentSessionOptions = {
    onApprove: async (data: OnApproveDataOneTimePayments): Promise<void> => {
      await handlePaymentApprove(data);
    },
    onCancel: handlePaymentCancel,
    onError: handlePaymentError
  };
  
  const paymentSession = sdkInstance.createPayPalOneTimePaymentSession(options);
  
  const button = document.querySelector('#paypal-button') as HTMLElement;
  button.removeAttribute('hidden');
  
  button.addEventListener('click', async () => {
    await paymentSession.start(
      { presentationMode: 'auto' },
      createOrder()
    );
  });
}

// Export for global access
(window as any).onPayPalWebSdkLoaded = onPayPalWebSdkLoaded;
```

## Configuration Options

### createInstance() Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `clientToken` | string | **Yes** | Server-generated browser-safe token |
| `components` | string[] | **Yes** | Array of components to load |
| `pageType` | string | **No** | Page context for optimization |
| `locale` | string | **No** | BCP-47 language code |
| `testBuyerCountry` | string | **No** | Country code for testing |

### Available Components

- `"paypal-payments"` - PayPal payment buttons
- `"venmo-payments"` - Venmo payment integration
- `"paypal-billing-agreements"` - Billing agreements

### Page Types

- `"cart"` - Shopping cart page
- `"checkout"` - Checkout page
- `"home"` - Home page
- `"mini-cart"` - Mini cart widget
- `"product-details"` - Product detail page
- `"product-listing"` - Product listing page
- `"search-results"` - Search results page

## Migration Checklist

- Remove v5 script tag with client-id
- Add v6 script tag without credentials
- Create client token generation endpoint on server
- Implement getBrowserSafeClientToken() function
- Replace paypal.Buttons() with createInstance()
- Use createPayPalOneTimePaymentSession() for payment session
- Update callback signatures (onApprove returns Promise, onCancel takes no params)
- Implement proper error handling
- Test SDK initialization and payment flow

## Common Issues

### Issue: "window.paypal is not defined"
**Cause**: SDK not loaded yet or script loading failed  
**Solution**: Ensure SDK script has `async` attribute and onload callback is defined

### Issue: "createInstance is not a function"
**Cause**: Using v5 SDK URL instead of v6  
**Solution**: Use `https://www.sandbox.paypal.com/web-sdk/v6/core`

### Issue: SDK initialization timeout
**Cause**: Client token generation failing  
**Solution**: Check server logs and PayPal API credentials

## Best Practices

**Load SDK asynchronously to avoid blocking page load**  
**Initialize SDK only after client token is retrieved**  
**Handle all error scenarios gracefully**  
**Provide loading states and user feedback**  
**Implement proper TypeScript types**  
**Test across different browsers and devices**  
**Log errors with PayPal debug IDs**  
**Use presentation mode "auto" for best UX**  

## Official Documentation

- **PayPal v6 SDK Guide**: [docs.paypal.ai/payments/methods/paypal/sdk/js/v6/paypal-checkout](https://docs.paypal.ai/payments/methods/paypal/sdk/js/v6/paypal-checkout)
- **Client Token Generation**: [docs.paypal.ai/payments/methods/paypal/sdk/js/v6/paypal-checkout](https://docs.paypal.ai/payments/methods/paypal/sdk/js/v6/paypal-checkout)
- **SDK Components**: [GitHub - v6 Components Types](https://github.com/paypal/paypal-js/tree/main/packages/paypal-js/types/v6/components)  

