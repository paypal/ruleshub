# Error Handling

## Comprehensive Error Handler Implementation

```javascript
// errorHandler.js

/**
 * Universal error handler for PayPal v6 operations
 * Extracts debug IDs, maps error codes, and provides user-friendly messages
 */
export function handlePaymentError(error, context = {}) {
  // Extract PayPal Debug ID (critical for support)
  const debugId = error.details?.debug_id 
    || error.debug_id 
    || error.response?.data?.debug_id
    || error.response?.headers?.['paypal-debug-id']
    || 'N/A';

  // Extract error code
  const errorCode = error.code 
    || error.response?.data?.name 
    || error.name 
    || 'UNKNOWN_ERROR';

  // Extract error message (for logging only, not for users)
  const errorMessage = error.message 
    || error.response?.data?.message 
    || 'Unknown error occurred';

  // Log comprehensive error details (for debugging)
  console.error('PayPal Error:', {
    code: errorCode,
    message: errorMessage,
    debugId: debugId,
    context: context,
    timestamp: new Date().toISOString(),
    userAgent: navigator?.userAgent,
    url: window?.location?.href,
    stack: error.stack
  });

  // Send to monitoring service
  trackErrorMetrics({
    errorCode,
    debugId,
    context
  });

  // Get user-friendly error message
  const userMessage = getUserFriendlyErrorMessage(errorCode, debugId);

  // Show error to user
  displayErrorToUser(userMessage, errorCode);

  // Determine if error is recoverable
  if (isRecoverableError(errorCode)) {
    showRetryOption(() => retryOperation(context));
  }

  // Suggest alternative payment methods if needed
  if (isPaymentMethodUnavailable(errorCode)) {
    suggestAlternativePaymentMethods();
  }

  return {
    errorCode,
    debugId,
    userMessage,
    isRecoverable: isRecoverableError(errorCode)
  };
}

/**
 * Map error codes to user-friendly messages
 */
export function getUserFriendlyErrorMessage(errorCode, debugId) {
  const errorMessages = {
    // Authentication & Token Errors
    'INVALID_CLIENT_TOKEN': 'Payment session expired. Please refresh the page and try again.',
    'CLIENT_TOKEN_EXPIRED': 'Payment session expired. Please refresh and try again.',
    'AUTHORIZATION_FAILED': 'Payment authorization failed. Please verify your PayPal account and try again.',
    
    // Network & Connectivity Errors
    'NETWORK_ERROR': 'Network connection issue. Please check your internet connection and try again.',
    'TIMEOUT_ERROR': 'Request timed out. Please try again.',
    'SERVER_ERROR': 'Our payment service is temporarily unavailable. Please try again in a few moments.',
    
    // Browser & Environment Errors
    'ERR_DEV_UNABLE_TO_OPEN_POPUP': 'Popup was blocked. Please allow popups for this site and try again.',
    'ERR_FLOW_PAYMENT_HANDLER_BROWSER_INCOMPATIBLE': "Your browser doesn't support this payment method. Please try a different payment option.",
    'UNSUPPORTED_BROWSER': 'Please use a supported browser (Chrome 69+, Safari 12+, Firefox 63+) for payments.',
    
    // Payment Flow Errors
    'PAYMENT_CANCELLED': 'Payment was cancelled. Your items are still in your cart.',
    'PAYMENT_DECLINED': 'Payment was declined. Please try a different payment method.',
    'INSUFFICIENT_FUNDS': 'Insufficient funds. Please choose a different payment method.',
    
    // Order & Validation Errors
    'ORDER_NOT_FOUND': 'Order not found. Please start checkout again.',
    'ORDER_ALREADY_CAPTURED': 'This order has already been processed. Please check your account.',
    'INVALID_AMOUNT': 'Invalid payment amount. Please refresh and try again.',
    'CURRENCY_NOT_SUPPORTED': 'Payment currency is not supported. Please contact support.',
    
    // Vault & Save Payment Errors
    'VAULT_NOT_ENABLED': 'Saving payment methods is not available for your account.',
    'SETUP_TOKEN_EXPIRED': 'Setup session expired. Please try saving your payment method again.',
    'PAYMENT_TOKEN_NOT_FOUND': 'Saved payment method not found. Please select a different payment method.',
    'CUSTOMER_NOT_ELIGIBLE': 'You are not eligible for saving payment methods.',
    
    // Regional & Eligibility Errors
    'PAYMENT_METHOD_NOT_AVAILABLE': 'This payment method is not available in your region.',
    'BUYER_NOT_ELIGIBLE': 'You are not eligible for this payment option. Please try a different method.',
    
    // Venmo-Specific Errors
    'VENMO_NOT_AVAILABLE': 'Venmo is not available in your region. Please use PayPal.',
    'VENMO_APP_NOT_INSTALLED': 'Please install the Venmo app or use a different payment method.',
    
    // Default
    'UNKNOWN_ERROR': debugId 
      ? `Payment failed. Reference ID: ${debugId}` 
      : 'Payment failed. Please try again or contact support.'
  };

  return errorMessages[errorCode] || errorMessages['UNKNOWN_ERROR'];
}

/**
 * Determine if error is recoverable (can retry)
 */
export function isRecoverableError(errorCode) {
  const recoverableCodes = [
    'NETWORK_ERROR',
    'TIMEOUT_ERROR',
    'ERR_DEV_UNABLE_TO_OPEN_POPUP',
    'CLIENT_TOKEN_EXPIRED',
    'SERVER_ERROR'
  ];
  
  return recoverableCodes.includes(errorCode);
}

/**
 * Check if payment method is unavailable
 */
export function isPaymentMethodUnavailable(errorCode) {
  const unavailableCodes = [
    'PAYMENT_METHOD_NOT_AVAILABLE',
    'ERR_FLOW_PAYMENT_HANDLER_BROWSER_INCOMPATIBLE',
    'BUYER_NOT_ELIGIBLE',
    'VENMO_NOT_AVAILABLE'
  ];
  
  return unavailableCodes.includes(errorCode);
}

/**
 * Display error message to user
 */
export function displayErrorToUser(message, errorCode) {
  const errorContainer = document.getElementById('payment-error');
  
  if (errorContainer) {
    errorContainer.innerHTML = `
      <div class="error-message ${errorCode.toLowerCase()}">
        <svg class="error-icon" viewBox="0 0 20 20" fill="currentColor">
          <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd" />
        </svg>
        <p class="error-text">${message}</p>
        <button class="error-dismiss" onclick="this.parentElement.style.display='none'">×</button>
      </div>
    `;
    errorContainer.style.display = 'block';
  } else {
    // Fallback: use alert if no error container
    alert(message);
  }
}

/**
 * Show retry option to user
 */
export function showRetryOption(retryCallback) {
  const errorContainer = document.getElementById('payment-error');
  
  if (errorContainer) {
    const retryButton = document.createElement('button');
    retryButton.className = 'retry-button';
    retryButton.textContent = 'Try Again';
    retryButton.onclick = retryCallback;
    
    errorContainer.querySelector('.error-message')?.appendChild(retryButton);
  }
}

```javascript
/**
 * Suggest alternative payment methods
 */
export function suggestAlternativePaymentMethods() {
  const alternativesContainer = document.getElementById('payment-alternatives');
  
  if (alternativesContainer) {
    alternativesContainer.innerHTML = `
      <div class="alternative-methods">
        <h4>Try these payment options instead:</h4>
        <ul>
          <li>PayPal account payment</li>
          <li>Credit or debit card via PayPal</li>
          <li>Bank transfer (where available)</li>
          <li>PayPal Credit (US only)</li>
        </ul>
      </div>
    `;
    alternativesContainer.style.display = 'block';
  }
}
```

/**
 * Track error metrics (send to monitoring service)
 */
export function trackErrorMetrics(errorData) {
  // Example: Send to analytics
  if (typeof gtag === 'function') {
    gtag('event', 'payment_error', {
      error_code: errorData.errorCode,
      debug_id: errorData.debugId,
      context: JSON.stringify(errorData.context)
    });
  }
  
  // Example: Send to custom monitoring service
  if (window.monitoringService) {
    window.monitoringService.trackError({
      type: 'PAYPAL_ERROR',
      ...errorData,
      timestamp: Date.now()
    });
  }
}

/**
 * Client token refresh with error handling
 */
export async function refreshClientToken(maxRetries = 2) {
  let lastError;
  
  for (let i = 0; i <= maxRetries; i++) {
    try {
      const response = await fetch('/paypal-api/auth/browser-safe-client-token');
      
      // Validate response is JSON
      const contentType = response.headers.get('content-type');
      if (!contentType?.includes('application/json')) {
        throw new Error('Expected JSON response, got HTML');
      }
      
      const { accessToken } = await response.json();
      console.log('Client token refreshed successfully');
      return accessToken;
      
    } catch (error) {
      lastError = error;
      console.warn(`Token refresh attempt ${i + 1} failed:`, error);
      
      if (i < maxRetries) {
        // Wait before retry
        await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
      }
    }
  }
  
  throw new Error(`Failed to refresh client token after ${maxRetries + 1} attempts: ${lastError.message}`);
}
```

## Usage Examples

### SDK Initialization Error Handling

```javascript
async function initializePayPalSDK() {
  try {
    const clientToken = await getBrowserSafeClientToken();
    
    const sdkInstance = await window.paypal.createInstance({
      clientToken,
      components: ["paypal-payments"],
      pageType: "checkout"
    });
    
    return sdkInstance;
    
  } catch (error) {
    handlePaymentError(error, {
      operation: 'SDK_INITIALIZATION',
      timestamp: Date.now()
    });
    throw error;
  }
}
```

### Payment Session Error Handling

```javascript
const paymentSession = sdkInstance.createPayPalOneTimePaymentSession({
  onApprove: async (data) => {
    try {
      await captureOrder({ orderId: data.orderId });
      window.location.href = '/success';
    } catch (error) {
      handlePaymentError(error, {
        operation: 'ORDER_CAPTURE',
        orderId: data.orderId
      });
    }
  },
  
  onError: (error) => {
    handlePaymentError(error, {
      operation: 'PAYMENT_SESSION',
      flow: 'ONE_TIME_PAYMENT'
    });
  },
  
  onCancel: () => {
    console.log('Payment cancelled by user');
    displayErrorToUser('Payment was cancelled. Your items are still in your cart.', 'PAYMENT_CANCELLED');
  }
});
```

### Server-Side Error Handling

```javascript
// Express.js error middleware
app.use((error, req, res, next) => {
  // Log error with context
  console.error('PayPal API Error:', {
    error: error.message,
    debugId: error.response?.headers?.['paypal-debug-id'],
    endpoint: req.originalUrl,
    method: req.method,
    timestamp: new Date().toISOString()
  });

  // Extract PayPal error details
  const statusCode = error.response?.status || 500;
  const debugId = error.response?.headers?.['paypal-debug-id'];
  
  // Send appropriate error response
  res.status(statusCode).json({
    error: getServerErrorCode(error),
    message: getUserFriendlyMessage(error),
    debugId: debugId,
    timestamp: new Date().toISOString()
  });
});
```

## HTML Template

```html
<div id="payment-error"></div>
<div id="payment-alternatives"></div>
```

## Best Practices

**Always extract and log PayPal debug IDs**  
**Provide user-friendly error messages (hide technical details)**  
**Implement retry logic for recoverable errors**  
**Track error metrics for monitoring**  
**Validate response content-type before parsing**  
**Handle errors at every level (client, server, API)**  
**Show loading states and error states clearly**  
**Never expose system details to users**  
**Test error scenarios thoroughly**  
**Implement graceful degradation**  

## Migration Notes

**v5 Pattern:**
```javascript
paypal.Buttons({
  onError: function(err) {
    console.error(err);
    alert('Payment failed');
  }
});
```

**v6 Pattern:**
```javascript
const session = sdkInstance.createPayPalOneTimePaymentSession({
  onError: (error) => {
    handlePaymentError(error, { operation: 'PAYMENT' });
  }
});
```

