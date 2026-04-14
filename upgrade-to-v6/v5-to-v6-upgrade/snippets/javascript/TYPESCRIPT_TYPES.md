# PayPal v6 SDK TypeScript Types Reference

**Single Source of Truth**  
**Official Source**: https://github.com/paypal/paypal-js/tree/main/packages/paypal-js/types/v6

This document captures all official TypeScript types for PayPal v6 Web SDK. Always use these types as the authoritative reference.

## Installation

```bash
npm install --save-dev @paypal/paypal-js
```

## Import Types

```typescript
import type {
  PayPalV6Namespace,
  CreateInstanceOptions,
  SdkInstance,
  PayPalOneTimePaymentSessionOptions,
  PayLaterOneTimePaymentSessionOptions,
  PayPalCreditOneTimePaymentSessionOptions,
  SavePaymentSessionOptions,
  VenmoOneTimePaymentSessionOptions,
  OnApproveDataOneTimePayments,
  OnApproveDataSavePayments,
  OnCompleteData,
  EligiblePaymentMethods,
  PaymentMethodDetails,
  PayLaterDetails,
  PayPalCreditDetails
} from "@paypal/paypal-js/sdk-v6";
```

## Core Interfaces

### PayPalV6Namespace

```typescript
interface PayPalV6Namespace {
  createInstance(options: CreateInstanceOptions): Promise<SdkInstance>;
}

declare global {
  interface Window {
    paypal: PayPalV6Namespace;
  }
}
```

### CreateInstanceOptions

```typescript
interface CreateInstanceOptions {
  clientToken: string; // Required: Server-generated client token
  components: ("paypal-payments" | "venmo-payments" | "paypal-legacy-billing-agreements")[]; // Required
  pageType?: "cart" | "checkout" | "home" | "mini-cart" | "product-details" | "product-listing" | "search-results";
  locale?: string; // BCP-47 language code (e.g., "en-US", "fr-FR")
  testBuyerCountry?: string; // Two-letter ISO country code for testing
  partnerAttributionId?: string;
  shopperSessionId?: string;
  clientMetadataId?: string;
}
```

### SdkInstance

```typescript
interface SdkInstance<T extends ("paypal-payments" | "venmo-payments" | "paypal-legacy-billing-agreements")[]> {
  findEligibleMethods(options?: FindEligibleMethodsOptions): Promise<EligiblePaymentMethods>;
  
  // PayPal Payment Sessions
  createPayPalOneTimePaymentSession(options: PayPalOneTimePaymentSessionOptions): OneTimePaymentSession;
  createPayPalSavePaymentSession(options: SavePaymentSessionOptions): SavePaymentSession;
  
  // Pay Later Payment Session
  createPayLaterOneTimePaymentSession(options: PayLaterOneTimePaymentSessionOptions): OneTimePaymentSession;
  
  // PayPal Credit Payment Session
  createPayPalCreditOneTimePaymentSession(options: PayPalCreditOneTimePaymentSessionOptions): OneTimePaymentSession;
  
  // Venmo Payment Session (if "venmo-payments" component loaded)
  createVenmoOneTimePaymentSession?(options: VenmoOneTimePaymentSessionOptions): OneTimePaymentSession;
}
```

## Eligibility Interfaces

### FindEligibleMethodsOptions

```typescript
interface FindEligibleMethodsOptions {
  currencyCode?: string; // Three-letter ISO currency code (e.g., "USD", "EUR")
  paymentFlow?: "VAULT_WITHOUT_PAYMENT"; // For save payment scenarios
}
```

### EligiblePaymentMethods

```typescript
interface EligiblePaymentMethods {
  isEligible(method: "paypal" | "venmo" | "paylater" | "credit"): boolean;
  getDetails(method: "paypal" | "venmo" | "paylater" | "credit"): PaymentMethodDetails;
}
```

### PaymentMethodDetails

```typescript
// Base interface
interface BasePaymentMethodDetails {
  canBeVaulted: boolean;
}

// Pay Later specific
interface PayLaterDetails extends BasePaymentMethodDetails {
  countryCode: "AU" | "DE" | "ES" | "FR" | "GB" | "IT" | "US";
  productCode: "PAYLATER" | "PAY_LATER_SHORT_TERM";
}

// PayPal Credit specific
interface PayPalCreditDetails extends BasePaymentMethodDetails {
  countryCode: "US" | "GB";
}

// PayPal and Venmo use BasePaymentMethodDetails
type PaymentMethodDetails = BasePaymentMethodDetails | PayLaterDetails | PayPalCreditDetails;
```

## Payment Session Options

### PayPalOneTimePaymentSessionOptions

**CRITICAL NOTES**:
- `onApprove` **MUST** return `Promise<void>`
- `onCancel` takes **NO** parameters
- `onError` receives `Error` object only
- `orderId` is optional (can pre-create order)

```typescript
interface PayPalOneTimePaymentSessionOptions {
  onApprove: (data: OnApproveDataOneTimePayments) => Promise<void>; // MUST return Promise
  onCancel?: () => void; // NO parameters
  onError?: (error: Error) => void; // Error object only
  onComplete?: (data: OnCompleteData) => void;
  testBuyerCountry?: string;
  orderId?: string; // Optional: pre-created order ID
  onShippingAddressChange?: (data: OnShippingAddressChangeData) => Promise<void>;
  onShippingOptionsChange?: (data: OnShippingOptionsChangeData) => Promise<void>;
}
```

### PayLaterOneTimePaymentSessionOptions

**Same as `PayPalOneTimePaymentSessionOptions`**

```typescript
interface PayLaterOneTimePaymentSessionOptions extends PayPalOneTimePaymentSessionOptions {}
```

### PayPalCreditOneTimePaymentSessionOptions

**Same as `PayPalOneTimePaymentSessionOptions`**

```typescript
interface PayPalCreditOneTimePaymentSessionOptions extends PayPalOneTimePaymentSessionOptions {}
```

### SavePaymentSessionOptions

**CRITICAL DIFFERENCES FROM ONE-TIME PAYMENTS**:
- `onApprove` returns `void` (NOT Promise)
- `orderId` is **FORBIDDEN** (will cause error)
- Receives `vaultSetupToken` instead of `orderId`

```typescript
interface SavePaymentSessionOptions {
  onApprove?: (data?: OnApproveDataSavePayments) => void; // Returns void, NOT Promise
  onCancel?: () => void; // NO parameters
  onError?: (error: Error) => void;
  onComplete?: (data: OnCompleteData) => void;
  testBuyerCountry?: string;
  clientMetadataId?: string;
  vaultSetupToken?: string;
  orderId?: never; // FORBIDDEN - will cause error
}
```

### VenmoOneTimePaymentSessionOptions

**US and USD only**

```typescript
interface VenmoOneTimePaymentSessionOptions {
  onApprove: (data: OnApproveDataOneTimePayments) => Promise<void>; // MUST return Promise
  onCancel?: () => void; // NO parameters
  onError?: (error: Error) => void;
  onComplete?: (data: OnCompleteData) => void;
  testBuyerCountry?: string; // Should be "US"
  orderId?: string;
}
```

## Callback Data Interfaces

### OnApproveDataOneTimePayments

**Used by**: PayPal, Pay Later, PayPal Credit, Venmo one-time payments

```typescript
interface OnApproveDataOneTimePayments {
  orderId: string; // PayPal order ID
  payerId?: string; // PayPal payer ID (optional)
  billingToken?: string; // Billing agreement token (optional)
}
```

### OnApproveDataSavePayments

**Used by**: Save payment sessions only

```typescript
interface OnApproveDataSavePayments {
  vaultSetupToken: string; // Setup token for creating payment token
  payerId?: string; // PayPal payer ID (optional)
}
```

### OnCompleteData

**Used by all payment sessions**

```typescript
interface OnCompleteData {
  paymentSessionState: "approved" | "canceled" | "error";
}
```

### OnShippingAddressChangeData

**Used for shipping callbacks**

```typescript
interface OnShippingAddressChangeData {
  orderId: string;
  shippingAddress: {
    countryCode: string;
    state?: string;
    city?: string;
    postalCode?: string;
  };
  errors: Record<"ADDRESS_ERROR", string>;
}
```

### OnShippingOptionsChangeData

**Used for shipping option callbacks**

```typescript
interface OnShippingOptionsChangeData {
  orderId: string;
  selectedShippingOption: {
    id: string;
    label: string;
    type: string;
  };
  errors: Record<"METHOD_UNAVAILABLE" | "STORE_UNAVAILABLE", string>;
}
```

## Payment Session Interfaces

### OneTimePaymentSession

```typescript
interface OneTimePaymentSession {
  start(
    presentationOptions: PresentationOptions,
    createOrderCallback: (() => Promise<{ orderId: string }>) | Promise<{ orderId: string }>
  ): Promise<void>;
}
```

### SavePaymentSession

```typescript
interface SavePaymentSession {
  start(
    presentationOptions: PresentationOptions,
    createSetupTokenCallback: (() => Promise<{ setupToken: string }>) | Promise<{ setupToken: string }>
  ): Promise<void>;
}
```

### PresentationOptions

```typescript
interface PresentationOptions {
  presentationMode: "auto" | "popup" | "modal" | "redirect" | "payment-handler";
}
```

## Complete TypeScript Example

```typescript
import type {
  PayPalV6Namespace,
  CreateInstanceOptions,
  SdkInstance,
  PayPalOneTimePaymentSessionOptions,
  PayLaterOneTimePaymentSessionOptions,
  OnApproveDataOneTimePayments,
  OnCompleteData,
  EligiblePaymentMethods,
  PayLaterDetails
} from "@paypal/paypal-js/sdk-v6";

// Extend Window interface
declare global {
  interface Window {
    paypal: PayPalV6Namespace;
  }
}

// Initialize SDK
async function initializePayPalSDK(): Promise<void> {
  try {
    const clientToken: string = await getBrowserSafeClientToken();
    
    const config: CreateInstanceOptions = {
      clientToken,
      components: ["paypal-payments"],
      pageType: "checkout",
      locale: "en-US"
    };
    
    const sdkInstance: SdkInstance<["paypal-payments"]> = 
      await window.paypal.createInstance(config);
    
    const methods: EligiblePaymentMethods = 
      await sdkInstance.findEligibleMethods({
        currencyCode: "USD"
      });
    
    if (methods.isEligible("paypal")) {
      await setupPayPalButton(sdkInstance);
    }
    
    if (methods.isEligible("paylater")) {
      const details: PayLaterDetails = methods.getDetails("paylater");
      await setupPayLaterButton(sdkInstance, details);
    }
    
  } catch (error) {
    console.error("SDK initialization failed:", error);
  }
}

// Payment session options with correct types
const paymentOptions: PayPalOneTimePaymentSessionOptions = {
  onApprove: async (data: OnApproveDataOneTimePayments): Promise<void> => {
    console.log("Order ID:", data.orderId);
    await captureOrder(data.orderId);
  },
  onCancel: (): void => {
    console.log("Payment cancelled");
  },
  onError: (error: Error): void => {
    console.error("Payment error:", error);
  },
  onComplete: (data: OnCompleteData): void => {
    console.log("State:", data.paymentSessionState);
  }
};

// Setup Pay Later button
async function setupPayLaterButton(
  sdkInstance: SdkInstance<["paypal-payments"]>,
  details: PayLaterDetails
): Promise<void> {
  const options: PayLaterOneTimePaymentSessionOptions = paymentOptions;
  
  const session = sdkInstance.createPayLaterOneTimePaymentSession(options);
  
  const button = document.querySelector("#paylater-button") as HTMLElement & {
    productCode: string;
    countryCode: string;
  };
  
  button.productCode = details.productCode;
  button.countryCode = details.countryCode;
  button.removeAttribute("hidden");
  
  button.addEventListener("click", async () => {
    await session.start(
      { presentationMode: "auto" },
      async (): Promise<{ orderId: string }> => {
        const response = await fetch("/api/orders", { method: "POST" });
        const { id }: { id: string } = await response.json();
        return { orderId: id }; // MUST return this structure
      }
    );
  });
}

async function getBrowserSafeClientToken(): Promise<string> {
  const response = await fetch("/api/token");
  const { accessToken }: { accessToken: string } = await response.json();
  return accessToken;
}

async function captureOrder(orderId: string): Promise<void> {
  await fetch(`/api/orders/${orderId}/capture`, { method: "POST" });
}
```

## Critical Type Differences

### onApprove Return Types

| Payment Type | Return Type | Reason |
|--------------|-------------|---------|
| One-Time Payment | `Promise<void>` | Must wait for capture |
| Save Payment | `void` | No immediate action needed |

### Callback Parameters

| Callback | Parameters | Type |
|----------|-----------|------|
| `onApprove` (one-time) | `data` | `OnApproveDataOneTimePayments` |
| `onApprove` (save) | `data?` | `OnApproveDataSavePayments` (optional) |
| `onCancel` | **NONE** | N/A |
| `onError` | `error` | `Error` |
| `onComplete` | `data` | `OnCompleteData` |

### Forbidden Parameters

| Session Type | Forbidden Parameter | Error |
|--------------|-------------------|-------|
| SavePaymentSession | `orderId` | Type error - property doesn't exist |

## Type Guards

```typescript
// Check if eligible methods has specific details
function isPayLaterDetails(details: PaymentMethodDetails): details is PayLaterDetails {
  return 'productCode' in details && 'countryCode' in details;
}

// Check if data is one-time payment data
function isOneTimePaymentData(
  data: OnApproveDataOneTimePayments | OnApproveDataSavePayments | undefined
): data is OnApproveDataOneTimePayments {
  return data !== undefined && 'orderId' in data;
}

// Check if data is save payment data
function isSavePaymentData(
  data: OnApproveDataOneTimePayments | OnApproveDataSavePayments | undefined
): data is OnApproveDataSavePayments {
  return data !== undefined && 'vaultSetupToken' in data;
}
```

## Validation Functions

```typescript
// Validate createOrder return value
function validateOrderCreation(result: any): asserts result is { orderId: string } {
  if (!result || typeof result !== 'object') {
    throw new Error('Order creation must return an object');
  }
  if (!('orderId' in result) || typeof result.orderId !== 'string') {
    throw new Error('Order creation must return { orderId: string }');
  }
}

// Validate createSetupToken return value
function validateSetupTokenCreation(result: any): asserts result is { setupToken: string } {
  if (!result || typeof result !== 'object') {
    throw new Error('Setup token creation must return an object');
  }
  if (!('setupToken' in result) || typeof result.setupToken !== 'string') {
    throw new Error('Setup token creation must return { setupToken: string }');
  }
}
```

## Best Practices

**Always import types from `@paypal/paypal-js/sdk-v6`**  
**Use exact return types for callbacks**  
**Validate createOrder returns `{ orderId: string }`**  
**Remember onCancel takes NO parameters**  
**Use type guards for payment method details**  
**Enable strict TypeScript mode**  
**Use type assertions sparingly**  
**Prefer explicit types over `any`**  
**Document custom types**  
**Use const assertions for literal types**  

## References

- **Official Types**: https://github.com/paypal/paypal-js/tree/main/packages/paypal-js/types/v6
- **PayPal Documentation**: https://docs.paypal.ai/payments/methods/paypal/sdk/js/v6/paypal-checkout
- **npm Package**: https://www.npmjs.com/package/@paypal/paypal-js

