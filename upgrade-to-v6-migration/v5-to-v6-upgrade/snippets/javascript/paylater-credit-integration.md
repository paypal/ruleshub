# PayLater and PayPal Credit Integration

**Official Documentation**: https://docs.paypal.ai/payments/methods/pay-later/get-started

## Overview

PayPal v6 SDK supports multiple financing options:
- **Pay Later**: Buy now, pay later financing (AU, DE, ES, FR, GB, IT, US)
- **PayPal Credit**: Credit-based payments (US, GB only)

## HTML Structure

```html
<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>Pay Later & Credit - PayPal v6</title>
  <meta name="viewport" content="width=device-width, initial-scale=1" />
</head>
<body>
  <h1>One-Time Payment with Financing Options</h1>
  
  <div class="financing-info">
    <h3>Flexible Payment Options</h3>
    <p>Choose the payment method that works best for you.</p>
  </div>
  
  <div class="buttons-container">
    <!-- All buttons hidden until eligibility is confirmed -->
    <paypal-button id="paypal-button" type="pay" hidden></paypal-button>
    <paypal-pay-later-button id="paylater-button" hidden></paypal-pay-later-button>
    <paypal-credit-button id="credit-button" hidden></paypal-credit-button>
  </div>
  
  <script src="app.js"></script>
  <script 
    async 
    src="https://www.sandbox.paypal.com/web-sdk/v6/core" 
    onload="onPayPalWebSdkLoaded()">
  </script>
</body>
</html>
```

## JavaScript Implementation

### Complete Integration (Official Pattern)

```javascript
// app.js - Based on official PayPal v6 documentation

/**
 * Main SDK initialization function
 * Called when PayPal v6 SDK finishes loading
 */
async function onPayPalWebSdkLoaded() {
  try {
    // Step 1: Get client token for authentication
    const clientToken = await getBrowserSafeClientToken();
    
    // Step 2: Create PayPal SDK instance
    const sdkInstance = await window.paypal.createInstance({
      clientToken,
      components: ["paypal-payments"], // Required for Pay Later and Credit
      pageType: "checkout", // Optimizes for checkout experience
    });

    // Step 3: Check eligibility for all payment methods
    const paymentMethods = await sdkInstance.findEligibleMethods({
      currencyCode: "USD", // Required - adjust for your currency
    });

    // Step 4: Setup buttons based on eligibility
    // Setup standard PayPal button if eligible
    if (paymentMethods.isEligible("paypal")) {
      setupPayPalButton(sdkInstance);
    }

    // Setup Pay Later button if eligible
    if (paymentMethods.isEligible("paylater")) {
      const paylaterDetails = paymentMethods.getDetails("paylater");
      setupPayLaterButton(sdkInstance, paylaterDetails);
    }

    // Setup PayPal Credit button if eligible
    if (paymentMethods.isEligible("credit")) {
      const creditDetails = paymentMethods.getDetails("credit");
      setupPayPalCreditButton(sdkInstance, creditDetails);
    }
    
  } catch (error) {
    console.error("SDK initialization error:", error);
    handleInitializationError(error);
  }
}

/**
 * Shared payment session options for all payment methods
 * These callbacks are used by PayPal, Pay Later, and Credit
 */
const paymentSessionOptions = {
  /**
   * Called when user approves payment
   * MUST return Promise<void>
   */
  async onApprove(data) {
    console.log("Payment approved:", data);
    try {
      // Capture the payment on your server
      const orderData = await captureOrder({
        orderId: data.orderId,
      });
      console.log("Payment captured successfully:", orderData);
      handlePaymentSuccess(orderData);
    } catch (error) {
      console.error("Payment capture failed:", error);
      handlePaymentError(error);
    }
  },
  
  /**
   * Called when user cancels payment
   * Takes NO parameters
   */
  onCancel() {
    console.log("Payment cancelled by user");
    handlePaymentCancellation();
  },
  
  /**
   * Called when an error occurs during payment
   * Receives Error object
   */
  onError(error) {
    console.error("Payment error:", error);
    handlePaymentError(error);
  },
  
  /**
   * Called when payment flow completes
   * Optional callback
   */
  onComplete(data) {
    console.log("Payment session completed:", data.paymentSessionState);
  }
};

/**
 * Setup standard PayPal button
 */
async function setupPayPalButton(sdkInstance) {
  const paypalSession = sdkInstance.createPayPalOneTimePaymentSession(
    paymentSessionOptions
  );

  const paypalButton = document.querySelector("#paypal-button");
  paypalButton.removeAttribute("hidden");

  paypalButton.addEventListener("click", async () => {
    try {
      await paypalSession.start(
        { presentationMode: "auto" }, // Auto-detects best presentation
        createOrder() // Create order on server
      );
    } catch (error) {
      console.error("PayPal payment start error:", error);
      handlePaymentError(error);
    }
  });
}

/**
 * Setup Pay Later button
 * IMPORTANT: Must configure productCode and countryCode from details
 */
async function setupPayLaterButton(sdkInstance, paylaterDetails) {
  // Create Pay Later payment session
  const paylaterSession = sdkInstance.createPayLaterOneTimePaymentSession(
    paymentSessionOptions
  );

  // Extract required details from eligibility check
  const { productCode, countryCode } = paylaterDetails;
  
  console.log("Pay Later details:", { productCode, countryCode });

  // Get button element
  const paylaterButton = document.querySelector("#paylater-button");

  // CRITICAL: Configure button with Pay Later specific details
  paylaterButton.productCode = productCode; // e.g., "PAYLATER" or "PAY_LATER_SHORT_TERM"
  paylaterButton.countryCode = countryCode; // e.g., "US", "GB", "AU", "DE", etc.
  
  // Show button
  paylaterButton.removeAttribute("hidden");

  // Add click handler
  paylaterButton.addEventListener("click", async () => {
    try {
      await paylaterSession.start(
        { presentationMode: "auto" },
        createOrder()
      );
    } catch (error) {
      console.error("Pay Later payment start error:", error);
      handlePaymentError(error);
    }
  });
}

/**
 * Setup PayPal Credit button
 * IMPORTANT: Must configure countryCode from details
 */
async function setupPayPalCreditButton(sdkInstance, creditDetails) {
  // Create PayPal Credit payment session
  const creditSession = sdkInstance.createPayPalCreditOneTimePaymentSession(
    paymentSessionOptions
  );

  // Extract required details
  const { countryCode } = creditDetails;
  
  console.log("PayPal Credit details:", { countryCode });

  // Get button element
  const creditButton = document.querySelector("#credit-button");

  // CRITICAL: Configure button with country code
  creditButton.countryCode = countryCode; // "US" or "GB"
  
  // Show button
  creditButton.removeAttribute("hidden");

  // Add click handler
  creditButton.addEventListener("click", async () => {
    try {
      await creditSession.start(
        { presentationMode: "auto" },
        createOrder()
      );
    } catch (error) {
      console.error("PayPal Credit payment start error:", error);
      handlePaymentError(error);
    }
  });
}

/**
 * Get client token from server
 */
async function getBrowserSafeClientToken() {
  const response = await fetch("/paypal-api/auth/browser-safe-client-token", {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
    },
  });
  
  if (!response.ok) {
    throw new Error(`Token fetch failed: ${response.status}`);
  }
  
  const { accessToken } = await response.json();
  return accessToken;
}

/**
 * Create order on server
 * IMPORTANT: Must return { orderId: "..." } in v6
 */
async function createOrder() {
  const response = await fetch("/paypal-api/checkout/orders/create", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      amount: "100.00", // Adjust for your order
      currency: "USD"
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
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
    }
  );
  
  if (!response.ok) {
    throw new Error(`Capture failed: ${response.status}`);
  }
  
  return await response.json();
}

/**
 * Handle successful payment
 */
function handlePaymentSuccess(orderData) {
  console.log("Payment successful:", orderData);
  
  // Show success message
  alert(`Payment completed successfully! Order ID: ${orderData.id}`);
  
  // Redirect to success page
  window.location.href = `/success?orderId=${orderData.id}`;
}

/**
 * Handle payment error
 */
function handlePaymentError(error) {
  console.error("Payment error:", error);
  
  // Get user-friendly error message
  const errorMessage = getUserFriendlyErrorMessage(error);
  
  // Show error to user
  alert(errorMessage);
}

/**
 * Handle payment cancellation
 */
function handlePaymentCancellation() {
  console.log("Payment cancelled");
  alert("Payment was cancelled. Your items are still in your cart.");
}

/**
 * Handle SDK initialization error
 */
function handleInitializationError(error) {
  console.error("Initialization failed:", error);
  alert("Unable to initialize payment system. Please refresh the page.");
}

/**
 * Get user-friendly error messages
 */
function getUserFriendlyErrorMessage(error) {
  const errorCode = error.code || error.name || 'UNKNOWN_ERROR';
  
  const messages = {
    'PAYLATER_NOT_AVAILABLE': 'Pay Later is not available. Please choose another payment method.',
    'CREDIT_NOT_AVAILABLE': 'PayPal Credit is not available. Please choose another payment method.',
    'BUYER_NOT_ELIGIBLE': "You don't qualify for financing at this time. Please choose another payment method.",
    'AMOUNT_TOO_LOW': 'Pay Later requires a minimum purchase amount.',
    'PAYMENT_CANCELLED': 'Payment was cancelled.',
    'PAYMENT_DECLINED': 'Payment was declined. Please try a different payment method.',
    'NETWORK_ERROR': 'Network error. Please check your connection and try again.',
  };
  
  return messages[errorCode] || 'Payment failed. Please try again.';
}

// Make function globally available for SDK callback
window.onPayPalWebSdkLoaded = onPayPalWebSdkLoaded;
```

## TypeScript Implementation

```typescript
// app.ts
import type {
  PayPalV6Namespace,
  SdkInstance,
  PayPalOneTimePaymentSessionOptions,
  PayLaterOneTimePaymentSessionOptions,
  PayPalCreditOneTimePaymentSessionOptions,
  OnApproveDataOneTimePayments,
  PayLaterDetails,
  PayPalCreditDetails
} from "@paypal/paypal-js/sdk-v6";

declare global {
  interface Window {
    paypal: PayPalV6Namespace;
  }
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
    
    const paymentMethods = await sdkInstance.findEligibleMethods({
      currencyCode: "USD"
    });
    
    if (paymentMethods.isEligible("paypal")) {
      await setupPayPalButton(sdkInstance);
    }
    
    if (paymentMethods.isEligible("paylater")) {
      const details: PayLaterDetails = paymentMethods.getDetails("paylater");
      await setupPayLaterButton(sdkInstance, details);
    }
    
    if (paymentMethods.isEligible("credit")) {
      const details: PayPalCreditDetails = paymentMethods.getDetails("credit");
      await setupPayPalCreditButton(sdkInstance, details);
    }
    
  } catch (error) {
    console.error("SDK initialization error:", error);
  }
}

const paymentSessionOptions: PayPalOneTimePaymentSessionOptions = {
  onApprove: async (data: OnApproveDataOneTimePayments): Promise<void> => {
    const orderData = await captureOrder({ orderId: data.orderId });
    handlePaymentSuccess(orderData);
  },
  onCancel: () => {
    handlePaymentCancellation();
  },
  onError: (error: Error) => {
    handlePaymentError(error);
  }
};

async function setupPayLaterButton(
  sdkInstance: SdkInstance<["paypal-payments"]>,
  details: PayLaterDetails
): Promise<void> {
  const paylaterOptions: PayLaterOneTimePaymentSessionOptions = paymentSessionOptions;
  
  const session = sdkInstance.createPayLaterOneTimePaymentSession(paylaterOptions);
  
  const button = document.querySelector("#paylater-button") as HTMLElement & {
    productCode: string;
    countryCode: string;
  };
  
  button.productCode = details.productCode;
  button.countryCode = details.countryCode;
  button.removeAttribute("hidden");
  
  button.addEventListener("click", async () => {
    await session.start({ presentationMode: "auto" }, createOrder());
  });
}

async function setupPayPalCreditButton(
  sdkInstance: SdkInstance<["paypal-payments"]>,
  details: PayPalCreditDetails
): Promise<void> {
  const creditOptions: PayPalCreditOneTimePaymentSessionOptions = paymentSessionOptions;
  
  const session = sdkInstance.createPayPalCreditOneTimePaymentSession(creditOptions);
  
  const button = document.querySelector("#credit-button") as HTMLElement & {
    countryCode: string;
  };
  
  button.countryCode = details.countryCode;
  button.removeAttribute("hidden");
  
  button.addEventListener("click", async () => {
    await session.start({ presentationMode: "auto" }, createOrder());
  });
}

(window as any).onPayPalWebSdkLoaded = onPayPalWebSdkLoaded;
```

## Payment Method Details

### Pay Later Details Structure

```typescript
interface PayLaterDetails {
  canBeVaulted: boolean;
  countryCode: "AU" | "DE" | "ES" | "FR" | "GB" | "IT" | "US";
  productCode: "PAYLATER" | "PAY_LATER_SHORT_TERM";
}
```

**Supported Countries**: Australia, Germany, Spain, France, United Kingdom, Italy, United States

**Product Codes**:
- `PAYLATER`: Standard Pay Later product
- `PAY_LATER_SHORT_TERM`: Short-term financing option

### PayPal Credit Details Structure

```typescript
interface PayPalCreditDetails {
  canBeVaulted: boolean;
  countryCode: "US" | "GB";
}
```

**Supported Countries**: United States, United Kingdom only

## Eligibility Checking

### Check All Payment Methods

```javascript
const paymentMethods = await sdkInstance.findEligibleMethods({
  currencyCode: "USD" // Required
});

// Check each method
const paypalEligible = paymentMethods.isEligible("paypal");
const paylaterEligible = paymentMethods.isEligible("paylater");
const creditEligible = paymentMethods.isEligible("credit");

console.log({
  paypal: paypalEligible,
  paylater: paylaterEligible,
  credit: creditEligible
});
```

### Get Payment Method Details

```javascript
// Only call getDetails() if isEligible() returns true
if (paymentMethods.isEligible("paylater")) {
  const details = paymentMethods.getDetails("paylater");
  console.log("Pay Later available:", details.productCode, details.countryCode);
}

if (paymentMethods.isEligible("credit")) {
  const details = paymentMethods.getDetails("credit");
  console.log("Credit available in:", details.countryCode);
}
```

## Error Handling

### Financing-Specific Errors

```javascript
function handleFinancingError(error) {
  switch (error.code) {
    case 'PAYLATER_NOT_AVAILABLE':
      return 'Pay Later is not available for this purchase.';
    
    case 'CREDIT_NOT_AVAILABLE':
      return 'PayPal Credit is not available.';
    
    case 'BUYER_NOT_ELIGIBLE':
      return 'You do not qualify for financing at this time.';
    
    case 'AMOUNT_TOO_LOW':
      return 'Pay Later requires a minimum purchase amount.';
    
    case 'COUNTRY_NOT_SUPPORTED':
      return 'Financing is not available in your country.';
    
    default:
      return 'Financing option unavailable. Please choose regular PayPal.';
  }
}
```

## Migration from v5

### v5 Pattern

```javascript
// v5: Using funding source with global object
paypal.Buttons({
  fundingSource: paypal.FUNDING.PAYLATER,
  style: {
    label: 'paylater',
    color: 'gold'
  },
  createOrder: function(data, actions) {
    return actions.order.create({
      purchase_units: [{
        amount: { value: '100.00' }
      }]
    });
  }
}).render('#paylater-button');
```

### v6 Pattern

```javascript
// v6: Dedicated session with eligibility check
const methods = await sdkInstance.findEligibleMethods({ currencyCode: "USD" });

if (methods.isEligible("paylater")) {
  const details = methods.getDetails("paylater");
  const session = sdkInstance.createPayLaterOneTimePaymentSession({ onApprove: ... });
  
  const button = document.querySelector("#paylater-button");
  button.productCode = details.productCode;
  button.countryCode = details.countryCode;
  button.removeAttribute("hidden");
  
  button.addEventListener("click", () => 
    session.start({ presentationMode: "auto" }, createOrder())
  );
}
```

## Best Practices

**Always check eligibility** before showing financing buttons  
**Set productCode and countryCode** on Pay Later button  
**Set countryCode** on PayPal Credit button  
**Provide regular PayPal fallback** if financing not eligible  
**Handle buyer decline gracefully** with clear messaging  
**Test across different countries** to verify availability  
**Monitor conversion rates** for each financing option  
**Show clear financing terms** to buyers  
**Ensure minimum amounts** are met for Pay Later  
**Use presentation mode "auto"** for best UX  

## Testing Checklist

- Test eligibility check with different currencies
- Verify productCode is set correctly on Pay Later button
- Verify countryCode is set correctly on all buttons
- Test in supported countries (US, GB, AU, DE, ES, FR, IT)
- Test fallback to regular PayPal when not eligible
- Test buyer approval and decline scenarios
- Verify button visibility logic works correctly
- Test error handling for ineligible buyers
- Test across desktop and mobile devices
- Verify order capture works for all financing types

## Common Issues

### Issue: Pay Later button not showing
**Cause**: Not setting productCode or countryCode  
**Solution**: Always set both properties from getDetails()

### Issue: "Credit not available" error
**Cause**: Buyer's country doesn't support PayPal Credit  
**Solution**: Only show Credit button in US and GB

### Issue: Eligibility check returns false
**Cause**: Buyer location, amount, or currency restrictions  
**Solution**: Always provide regular PayPal as fallback

### Issue: Button attributes not working
**Cause**: Forgetting to set attributes before removing hidden  
**Solution**: Set productCode/countryCode before removeAttribute("hidden")

## Official Documentation References

- **Pay Later Guide**: https://docs.paypal.ai/payments/methods/pay-later/get-started
- **PayPal Checkout**: https://docs.paypal.ai/payments/methods/paypal/sdk/js/v6/paypal-checkout
- **TypeScript Types**: https://github.com/paypal/paypal-js/tree/main/packages/paypal-js/types/v6

