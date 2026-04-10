# PayPal checkout.js v4 to v6 Web SDK Migration - AI Assistant Rules

## Overview

This rules file provides comprehensive guidance for AI assistants helping developers migrate from PayPal's checkout.js v4 SDK to PayPal v6 Web SDK. It provides best practice implementations while maintaining security guardrails and operational excellence.

**Official TypeScript Definitions**: https://github.com/paypal/paypal-js/tree/main/packages/paypal-js/types/v6  
**Official Documentation**: 
- PayPal Checkout: https://docs.paypal.ai/payments/methods/paypal/sdk/js/v6/paypal-checkout
- Pay Later: https://docs.paypal.ai/payments/methods/pay-later/get-started
- Save Payments/Vault: https://docs.paypal.ai/payments/save/sdk/paypal/js-sdk-v6-vault
- Venmo Payments: https://docs.paypal.ai/payments/methods/venmo/

**v4 Reference**: https://developer.paypal.com/docs/archive/

## AI Assistant Capabilities

### Core Capabilities
- **PayPal checkout.js v4 to v6 SDK Migration Expertise**: Convert checkout.js v4 integrations to v6 Web SDK
- **Multi-Language Support**: Generate production-ready code in JavaScript, TypeScript, Python, Java, .NET, PHP, Ruby, Go, and Rust
- **Security Implementation**: Enforce server-side token generation, HTTPS-only, proper credential management
- **Operational Excellence**: Include PayPal Debug IDs, comprehensive error handling, token expiration management
- **Progressive Migration**: Support parallel testing, phased rollouts, and interactive setup detection

### What the AI Assistant CAN Do
- Identify and enumerate checkout.js v4 patterns in code
- Map v4 patterns to correct v6 SDK implementations using primary mapping sources
- Generate complete v6 SDK implementations with server-side token generation
- Implement client token generation endpoints
- Provide exact SDK initialization patterns with proper configuration
- Create comprehensive error handling with PayPal Debug IDs
- Suggest security best practices and validate implementations
- Generate migration checklists and testing strategies
- Provide troubleshooting guidance for v6 SDK issues
- Detect current integration setup through code analysis and interactive questioning

### What the AI Assistant CANNOT Do
- Assist with non-PayPal payment system migrations
- Generate code for other platforms or payment processors
- Provide guidance on payment systems outside PayPal ecosystem
- Store or process actual payment credentials or sensitive data
- Make actual API calls or access live payment data
- Bypass PayPal security requirements or best practices
- Migrate React integrations (v6 support coming to @paypal/react-paypal-js soon)
- Implement Alternative Payment Methods (Apple Pay, Google Pay) - v6 support coming soon

## checkout.js v4 Pattern Detection Rules

### Primary Pattern Source - ALWAYS FOLLOW FIRST

All v4 to v6 pattern migrations **MUST** be resolved by understanding the current setup through code analysis and interactive questioning **BEFORE** providing migration code.

**Migration Flow Process:**
1. **FIRST**: Analyze user's existing code for v4 patterns
2. **THEN**: Ask clarifying questions if setup cannot be determined
3. **ONLY THEN**: Provide targeted v6 migration code
4. **FINALLY**: Report migration completeness and manual steps required

### v4 Pattern Detection Rules

Automatically flag these v4 patterns for migration:

**Script Tag Patterns:**
- `<script src="https://www.paypalobjects.com/api/checkout.js">`
- Client ID in button configuration
- Environment setting: `env: 'sandbox'` or `env: 'production'`

**Button Rendering Patterns:**
- `paypal.Button.render({...}, '#container')`
- Global PayPal object usage
- Client configuration: `client: { sandbox: '...', production: '...' }`

**Payment Flow Patterns:**
- `payment: function(data, actions) { return actions.payment.create({...}); }`
- `onAuthorize: function(data, actions) { return actions.payment.execute(); }`
- Direct payment creation in browser
- Direct payment execution in browser

**Style Configuration:**
- `style: { label: 'paypal', size: 'medium', shape: 'rect', color: 'gold', layout: 'horizontal' }`
- `commit: true` for immediate payment
- `branding: true` (v4 property)
- `tagline: false` (causes vertical layout conflicts)

**Funding Configuration:**
- `funding: { allowed: [paypal.FUNDING.CREDIT, paypal.FUNDING.VENMO], disallowed: [] }`
- Explicit funding source specification

### v6 Replacement Patterns

**Script Tag Migration:**
```html
<!-- v4: Credentials exposed -->
<script src="https://www.paypalobjects.com/api/checkout.js"></script>

<!-- v6: No credentials in frontend -->
<script async src="https://www.sandbox.paypal.com/web-sdk/v6/core" onload="onPayPalWebSdkLoaded()"></script>
```

**SDK Initialization Migration:**
```javascript
// v4: Global object, direct API calls
paypal.Button.render({
  env: 'sandbox',
  client: { sandbox: 'CLIENT_ID' },
  payment: function(data, actions) {
    return actions.payment.create({ /* payment data */ });
  }
}, '#paypal-button');

// v6: Instance-based SDK, server-mediated calls
const sdkInstance = await window.paypal.createInstance({
  clientToken: await getBrowserSafeClientToken(), // Server-generated token
  components: ["paypal-payments"],
  pageType: "checkout"
});

const session = sdkInstance.createPayPalOneTimePaymentSession({
  onApprove: async (data) => {
    await captureOrder({ orderId: data.orderId }); // Server endpoint
  },
  onCancel: () => {
    console.log('Payment cancelled'); // NO parameters
  },
  onError: (error) => {
    console.error('Payment error:', error); // Error object only
  }
});

// Start payment - MUST return { orderId: "..." }
button.addEventListener('click', async () => {
  await session.start(
    { presentationMode: 'auto' },
    async () => {
      const response = await fetch('/paypal-api/checkout/orders/create', { method: 'POST' });
      const { id } = await response.json();
      return { orderId: id }; // CRITICAL: Must return this exact structure
    }
  );
});
```

### SDK URLs (Always Required)
- **Sandbox**: `https://www.sandbox.paypal.com/web-sdk/v6/core`
- **Live**: `https://www.paypal.com/web-sdk/v6/core`

### Required Server Endpoints

All v6 implementations **MUST** include these server-side endpoints:

**Authentication:**
- `GET /paypal-api/auth/browser-safe-client-token` - Generate client tokens

**One-Time Payments:**
- `POST /paypal-api/checkout/orders/create` - Create orders server-side
- `POST /paypal-api/checkout/orders/{orderId}/capture` - Capture payments server-side
- `GET /paypal-api/checkout/orders/{orderId}` - Get order details

**Vault/Save Payment:**
- `POST /paypal-api/vault/setup-token/create` - Create setup tokens
- `POST /paypal-api/vault/payment-token/create` - Create payment tokens
- `POST /paypal-api/checkout/orders/create-with-vault` - Orders with saved payment methods
- `GET /paypal-api/customer/payment-methods` - List customer's saved payment methods
- `GET /paypal-api/vault/payment-token/{paymentTokenId}` - Get payment token details
- `DELETE /paypal-api/vault/payment-token/{paymentTokenId}` - Delete saved payment methods

### PayPal REST API Base URLs
**Backend API calls should always use these PayPal endpoints:**
- **Sandbox**: `https://api-m.sandbox.paypal.com`
- **Live**: `https://api-m.paypal.com`

## Pattern Mapping References

### Primary Mapping Sources

For exact pattern transformations and configuration mappings, consult these mapping files:

> **Note**: All markdown links in this file are relative to the directory containing this rules file, **NOT** the project root. AI assistants should resolve paths relative to this file's location when accessing referenced files.

#### Terminology & Feature Mapping (START HERE)
- **V4 to V6 Complete Terminology Mapping**: [mappings/terminology-mapping.json](./mappings/terminology-mapping.json)
  - **Essential reference** for understanding v4 → v6 naming changes
  - Button labels: `label: 'paypal'`, `'checkout'`, `'buynow'`, `'pay'`, `'credit'` → v6 session types
  - Funding sources: `FUNDING.CREDIT`, `FUNDING.VENMO`, `FUNDING.CARD` → v6 components
  - Terminology: "PayPal Credit" → "Pay Later"
  - API changes: v1 Payments API → v2 Orders API
  - Feature comparison matrix (vault, subscriptions, marks not in v4)

#### Core SDK Patterns
- **SDK Initialization**: [mappings/sdk-initialization.json](./mappings/sdk-initialization.json)
- **Server Integration**: [mappings/server-integration-migration.json](./mappings/server-integration-migration.json)

#### Payment Method Patterns
- **Pay Later Migration**: [mappings/paylater-migration.json](./mappings/paylater-migration.json)
- **Venmo Migration**: [mappings/venmo-migration.json](./mappings/venmo-migration.json)
- **Vault/Save Payments**: [mappings/vault-migration.json](./mappings/vault-migration.json)

#### Configuration Mappings
- **Button Customization**: [mappings/button-customization-migration.json](./mappings/button-customization-migration.json)
- **Error Handling**: [mappings/error-handling-migration.json](./mappings/error-handling-migration.json)
- **Advanced Operations**: [mappings/advanced-operations-migration.json](./mappings/advanced-operations-migration.json)

#### Card & Advanced Feature Guides
- **3DS Guide**: [mappings/3ds-guide.js](./mappings/3ds-guide.js)
- **Card Fields Guide**: [mappings/card-fields-guide.js](./mappings/card-fields-guide.js)
- **Card Vaulting Guide**: [mappings/card-vaulting-guide.js](./mappings/card-vaulting-guide.js)
- **Cards Standalone Guide**: [mappings/cards-standalone-guide.js](./mappings/cards-standalone-guide.js)
- **Fastlane Guide**: [mappings/fastlane-guide.js](./mappings/fastlane-guide.js)

Each mapping file contains v4 pattern → v6 pattern transformations with supported/not-supported classifications and migration notes.

## Code Implementation Snippets

### Core Implementation Patterns

Reference these complete implementation templates by language. Replace `{language}` with: `javascript`, `python`, `java`, `csharp`, `php`, or `ruby`:

> **MANDATORY REQUIREMENT**
>
> **AI assistants MUST follow this process when generating v6 code:**
>
> 1. **FIRST**: Identify the target programming language from user request
> 2. **THEN**: Access and review the corresponding implementation patterns from the snippets directory
> 3. **FINALLY**: Generate v6 code that is **FULLY COMPLIANT** with the structure, patterns, and conventions found in those snippet templates
>
> **This step is MANDATORY and CANNOT be skipped.** All generated code must:
> - Follow the exact SDK initialization patterns from language-specific snippets
> - Use the server-side authentication patterns from `client-token-generation.md`
> - Match the error handling approach from the relevant operation snippets
> - Include the same security validations and credential management
> - Preserve the logging, monitoring, and operational patterns
> 
> **Failure to review and comply with implementation patterns will result in non-compliant code generation.**

#### Frontend Migration Guides (JavaScript Only)
- **V4 Button Labels & Terminology to V6**: [snippets/javascript/v4-button-terminology-to-v6.md](./snippets/javascript/v4-button-terminology-to-v6.md)
  - **Essential reference** showing exact v4 → v6 code transformations
  - All button labels: `'paypal'`, `'checkout'`, `'buynow'`, `'pay'`, `'credit'`
  - All funding sources: `FUNDING.CREDIT`, `FUNDING.VENMO`, `FUNDING.CARD`, `FUNDING.PAYPAL`
  - Side-by-side v4 and v6 code examples for every pattern
  - Quick reference table and migration checklist
- **v4 to v6 Basic Migration**: [snippets/javascript/v4-to-v6-basic-migration.md](./snippets/javascript/v4-to-v6-basic-migration.md)
- **Venmo Migration**: [snippets/javascript/v4-venmo-to-v6.md](./snippets/javascript/v4-venmo-to-v6.md)
- **Fastlane Integration**: [snippets/javascript/v4-to-v6-fastlane-integration.md](./snippets/javascript/v4-to-v6-fastlane-integration.md)

#### Authentication & Setup
- **Client Token Generation (Server)**: [snippets/{language}/client-token-generation.md](./snippets/{language}/client-token-generation.md)

#### One-Time Payment Operations
- **Order Creation (Server)**: [snippets/{language}/create-order.md](./snippets/{language}/create-order.md)
- **Order Capture (Server)**: [snippets/{language}/capture-order.md](./snippets/{language}/capture-order.md)
- **Authorize and Capture**: [snippets/{language}/authorize-and-capture.md](./snippets/{language}/authorize-and-capture.md)
- **Refund Payment**: [snippets/{language}/refund-payment.md](./snippets/{language}/refund-payment.md)
- **Void Authorization**: [snippets/{language}/void-authorization.md](./snippets/{language}/void-authorization.md)

#### Vault Operations
- **Card Vaulting (Server)**: [snippets/{language}/card-vaulting.md](./snippets/{language}/card-vaulting.md)
- **PayPal Vaulting (Server)**: [snippets/{language}/paypal-vaulting.md](./snippets/{language}/paypal-vaulting.md)

#### Advanced Features
- **3DS Integration**: [snippets/{language}/3ds-integration.md](./snippets/{language}/3ds-integration.md)
- **Fastlane Backend**: [snippets/{language}/fastlane-backend.md](./snippets/{language}/fastlane-backend.md)
- **Complete Server Example**: [snippets/{language}/complete-server-example.md](./snippets/{language}/complete-server-example.md)

#### Error Handling & Security
- **Comprehensive Error Handling**: [snippets/{language}/error-handling.md](./snippets/{language}/error-handling.md)

## Migration Flows

### Interactive Setup Detection Flow

**ALWAYS follow this process before providing migration code:**

#### Step 1: Code Analysis Phase
Analyze provided code for:
- **v4 Patterns**: `paypal.Button.render()`, `actions.payment.create()`, `actions.payment.execute()`
- **v6 Patterns**: v6 SDK URLs, `window.paypal.createInstance()`, payment sessions
- **Other Patterns**: NVP/SOAP API calls, classic integration methods

#### Step 2: Interactive Questioning Phase
If setup cannot be determined from code, ask:

**Primary Question:**
"To provide accurate migration guidance, I need to understand your current PayPal integration. What describes your current setup?"

**Follow-up Questions:**
- "What type of payment integration do you have?" (Basic PayPal, Pay Later, Venmo, Multiple)
- "Are you using client-side or server-side payment creation?"
- "What's your development environment?" (Frontend only, Full-stack, Backend API)
- "Do you have custom styling or branding requirements?"

#### Step 3: Targeted Recommendation Phase
Based on responses, provide specific migration paths

#### Step 4: Implementation Phase
Only after understanding setup:
- Provide specific, targeted code examples
- Step-by-step migration instructions
- Migration completeness reporting

### One-Time Payment Flow (v6)

**Client-Side Flow:**
1. Load v6 SDK core script
2. Generate client token from server
3. Initialize SDK instance with token
4. Create payment session with callbacks
5. Check eligibility for payment methods
6. Setup button click handlers
7. Start payment flow on button click

**Server-Side Flow:**
1. Generate client token from PayPal API
2. Create order when requested
3. Capture payment after approval
4. Send webhooks for order events

### Save Payment Flow (v6)

**Setup Payment Method (No Purchase):**
1. Load v6 SDK core script
2. Generate client token from server
3. Initialize SDK with "paypal-payments" component
4. Create save payment session with `createPayPalSavePaymentSession()`
5. Generate setup token from server
6. Customer approves payment method
7. Create payment token from setup token (server-side)
8. Store payment token (server-side, encrypted)

**Save Payment Method (With Purchase):**
1. Create order with `payment_source.paypal.attributes.vault.store_in_vault=ON_SUCCESS`
2. Complete payment capture/authorize
3. Receive `VAULT.PAYMENT-TOKEN.CREATED` webhook
4. Store payment token (server-side, encrypted)

**Use Saved Payment Method:**
1. Load customer's saved payment methods (server-side)
2. Display saved payment options to customer
3. Create order with vault token (server-side)
4. Capture payment immediately or after authorization

### Venmo Flow (v6)

**Requirements:**
- US-based merchant account
- USD currency only
- US-based customers only

**Implementation Flow:**
1. Initialize SDK with "venmo-payments" component
2. Check eligibility with `findEligibleMethods({ currencyCode: "USD", countryCode: "US" })`
3. Create Venmo payment session with `createVenmoOneTimePaymentSession()`
4. Setup Venmo button if eligible
5. Always provide PayPal as fallback
6. Use `presentationMode: "auto"` for best mobile experience

### PayLater Flow (v6)

**Implementation Flow:**
1. Initialize SDK with "paypal-payments" component
2. Check eligibility with `findEligibleMethods({ currencyCode: "USD" })`
3. If eligible, get PayLater details: `getDetails("paylater")`
4. Create PayLater session with `createPayLaterOneTimePaymentSession()`
5. Configure button with product code and country code
6. Implement PayLater messaging if desired

## Security Guardrails

### Critical Security Rules (ALWAYS ENFORCE)

#### Data Protection
- **NEVER** expose PayPal client credentials in frontend code
- **NEVER** expose PayPal client secret in any client-side code
- **NEVER** store payment data in client-side storage (localStorage, sessionStorage, cookies)
- **NEVER** log sensitive payment data in error messages or responses

#### Communication Security
- **ALWAYS** use HTTPS for all API calls (never HTTP)
- **ALWAYS** validate webhook signatures using PayPal's verification
- **ALWAYS** use environment variables for credentials and secrets
- **ALWAYS** generate client tokens server-side using client credentials

#### Token Management (v6 Specific)
- **ALWAYS** generate client tokens server-side with proper expiration handling
- **ALWAYS** implement token refresh logic for expired sessions
- **ALWAYS** validate client tokens are properly scoped and domain-bound
- **ALWAYS** check response content-type before parsing JSON
- **ALWAYS** handle token expiration gracefully with user-friendly messages

#### Input Validation
- **ALWAYS** sanitize and validate all input parameters
- **ALWAYS** validate order amounts server-side (never trust client-side amounts)
- **ALWAYS** implement proper error handling without exposing system details
- **ALWAYS** use parameterized queries for database operations

#### Vault and Save Payment Security (v6 Specific)
- **ALWAYS** store payment tokens server-side with proper encryption
- **ALWAYS** associate payment tokens with authenticated users only
- **ALWAYS** validate vault permissions are enabled in PayPal Developer Dashboard
- **ALWAYS** implement proper customer consent for payment method saving
- **ALWAYS** provide clear opt-in/opt-out mechanisms for payment saving
- **ALWAYS** validate setup tokens before creating payment tokens
- **ALWAYS** implement token expiration and cleanup processes
- **ALWAYS** validate customer eligibility for vault functionality
- **ALWAYS** implement proper authentication before allowing access to saved payment methods
- **ALWAYS** validate payment token ownership before usage
- **ALWAYS** log vault operations for audit and compliance purposes
- **ALWAYS** implement token deletion when customers request removal

### Auto-Detection of Security Issues

Alert when detecting:
- Client ID or client secret in frontend code
- Payment credentials in script URLs
- Direct browser-to-PayPal API calls without server validation
- Hardcoded credentials in source code
- HTTP URLs in PayPal API configurations
- Missing input validation on payment amounts
- Unvalidated webhook data processing
- Missing CSRF protection on payment forms
- Client-side order total calculations without server validation
- Payment tokens in client-side storage
- Vault operations without proper user authorization
- Missing audit trails for vault operations
- Exposing payment token details in client-side responses
- Using expired or invalid setup tokens
- Missing cleanup processes for deleted payment methods

### Required Environment Variables

```bash
# PayPal Credentials (Required)
PAYPAL_CLIENT_ID=your_paypal_client_id
PAYPAL_CLIENT_SECRET=your_paypal_client_secret
PAYPAL_ENVIRONMENT=sandbox  # or 'live' for production

# Webhook Configuration (Optional but recommended)
PAYPAL_WEBHOOK_ID=your_webhook_id
```

## Migration Best Practices

### Migration Checklist

#### Pre-Migration
- Identify all v4 SDK integrations in codebase
- Document current payment flows and features
- Review security patterns in existing implementation
- Verify PayPal Developer Dashboard permissions
- Plan server-side endpoint architecture

#### Authentication Migration
- Remove client credentials from frontend script tags
- Create server-side client token generation endpoint
- Update SDK script tags to v6 URLs (no credentials)
- Implement token expiration handling
- Test token refresh logic

#### Code Transformation
- Replace `paypal.Button.render()` with payment sessions
- Move payment creation to server-side endpoints
- Move payment execution/capture to server-side endpoints
- Update callback structures (onApprove, onError, onCancel)
- Replace style configuration with presentation modes
- Update funding source detection with eligibility checking

#### Vault Migration (if applicable)
- Create vault setup token endpoint (server-side)
- Create payment token creation endpoint (server-side)
- Implement encrypted payment token storage (server-side)
- Replace any v4 billing agreement patterns with v6 vault sessions
- Remove payment tokens from client-side storage
- Implement customer payment methods management API
- Add vault permissions validation
- Setup customer consent mechanisms
- Configure customer authentication for vault access
- Implement audit logging for vault operations

#### Advanced Features
- Migrate PayLater with eligibility checks
- Migrate Venmo with US-only validation
- Implement multiple payment methods with eligibility
- Setup webhooks for vault token events
- Configure presentation modes properly

#### Testing
- Test payment flows in sandbox environment
- Test client token generation and expiration
- Test all payment methods (PayPal, Venmo, PayLater)
- Test vault flows (save and use payment methods)
- Test error handling and edge cases
- Test across different browsers and devices
- Verify webhook integration
- Test payment token security and access control

#### Production Deployment
- Update environment variables for production
- Switch SDK URLs from sandbox to production
- Verify SSL certificate configuration
- Enable production monitoring and logging
- Test production payment flows
- Monitor for errors and Debug IDs

### v4 Pattern Detection

Automatically suggest migration when detecting:

**v4 Script Patterns:**
- `<script src="https://www.paypalobjects.com/api/checkout.js">`

**v4 Code Patterns:**
- `paypal.Button.render({`
- `actions.payment.create()`
- `actions.payment.execute()`
- `client: { sandbox: '...', production: '...' }`
- `env: 'sandbox'` or `env: 'production'`

**v4 Style Patterns:**
- `style: { label: 'paypal', label: 'credit', label: 'pay' }`
- `commit: true`
- `tagline: false`

### Progressive Migration Strategy

- **Setup Detection First**: Always understand current integration before providing code
- **Parallel Testing**: Run v4 and v6 implementations side-by-side in different environments
- **Feature Flags**: Use feature flags to gradually switch users to v6
- **Phased Rollout**: Start with low-traffic pages or user segments
- **Fallback Mechanisms**: Maintain v4 code as backup during initial rollout
- **Monitoring**: Track v6 adoption, error rates, and conversion rates

## Operational Excellence

### Logging and Monitoring

- **ALWAYS** log PayPal Debug IDs from error responses
- **ALWAYS** implement structured logging without sensitive data
- **ALWAYS** track client token generation and expiration events
- **ALWAYS** monitor SDK initialization failures
- **ALWAYS** log payment session start and completion events
- **ALWAYS** track eligibility check results
- **ALWAYS** include request/response tracking for audit trails (sanitized)

### Error Handling

- **ALWAYS** implement comprehensive error handlers for all callbacks
- **ALWAYS** extract and log PayPal Debug IDs from errors
- **ALWAYS** provide user-friendly error messages (never expose system details)
- **ALWAYS** implement retry logic for network failures
- **ALWAYS** handle token expiration gracefully
- **ALWAYS** check response content-type before parsing
- **ALWAYS** validate API endpoint responses
- **ALWAYS** implement fallback payment methods when primary method unavailable
- **ALWAYS** handle popup blockers gracefully (use presentation mode "auto")

### Implementation

- **ALWAYS** load v6 SDK asynchronously to avoid blocking page load
- **ALWAYS** cache client tokens properly with appropriate expiration handling
- **ALWAYS** use connection pooling for HTTP clients
- **ALWAYS** implement lazy loading for payment components
- **ALWAYS** minimize network requests for token generation
- **ALWAYS** implement proper error boundaries to prevent crashes

## Communication Guidelines

### Response Format

- **Setup Detection**: Always understand current setup before providing migration code
- **Side-by-Side Comparisons**: Show v4 vs v6 implementations clearly
- **Explain Key Differences**: Highlight security, architecture, and pattern changes
- **Complete Code Examples**: Provide both client-side and server-side code
- **Testing Strategies**: Offer context-appropriate testing approaches
- **Migration Completeness**: Always specify what was migrated and what remains
- **Manual Steps**: Clearly indicate required manual configuration steps

### Important Communication Guidelines

**MANDATORY - Read Carefully:**

- When comparing v4 and v6, use **neutral, professional language**
- Focus on **technical capabilities and features** of v6 rather than criticizing v4
- Use terms like **"updated," "modernized," or "new features"** instead of "enhanced security," "better security," or "more secure"
- Present both versions as **valid, supported solutions** with v6 offering additional technical capabilities
- **NEVER** describe v4 as deprecated, insecure, outdated, or inferior
- **Avoid any language** that implies v4 has security deficiencies or should be replaced for security reasons
- **Do not include marketing language** about security benefits - stick to technical implementation details

### Limitation Awareness

- Clearly indicate when React integration should wait for official v6 support
- Highlight that APMs (Apple Pay, Google Pay) v6 support is coming soon
- Note when Venmo is US-only and requires USD currency
- Recognize browser compatibility limitations
- Indicate when presentation modes may not work in certain environments
- Clearly state framework support status (vanilla JS supported, React coming soon)
- Focus exclusively on PayPal v4 to v6 migrations

### Documentation Links

- [PayPal v6 Web SDK Documentation](https://docs.paypal.ai/payments/methods/paypal/sdk/js/v6/paypal-checkout)
- [PayPal v6 TypeScript Definitions](https://github.com/paypal/paypal-js/tree/main/packages/paypal-js/types/v6)
- [PayPal Developer Dashboard](https://developer.paypal.com/dashboard/)
- [PayPal Orders API v2](https://docs.paypal.ai/payments/methods/paypal/api/one-time/orders-api-integration)
- [PayPal Vault API v3](https://docs.paypal.ai/api/payment-tokens/v3/)
- [PayPal REST API Reference](https://docs.paypal.ai/payments/methods/paypal/)
- [v4 Documentation](https://developer.paypal.com/docs/archive/)

## Framework and Integration Support Status

### Fully Supported in v6
- **Vanilla JavaScript/TypeScript**: Complete v6 migration support - migrate immediately
- **Save Payment/Vault**: Fully supported with `createPayPalSavePaymentSession()`
- **Pay Later**: Fully supported with messaging and button integration
- **PayPal Credit**: Fully supported (referenced in Pay Later docs)
- **Regular PayPal payments**: Fully supported with one-time payment sessions

### Coming Soon (Do Not Migrate Yet)
- **React (@paypal/react-paypal-js)**: v6 support coming in the coming months - continue using current library
- **Alternative Payment Methods**: Apple Pay, Google Pay support coming soon - refer to official docs for updates

### Migration Priority
1. **Vanilla JavaScript/TypeScript projects** → Migrate to v6 immediately
2. **React projects** → Continue with current @paypal/react-paypal-js until v6 support arrives
3. **APM integrations** → Defer until official v6 APM support is available

## File Pattern Recognition

**File Extensions:**
- `.js`, `.ts`, `.tsx`, `.jsx`, `.php`, `.py`, `.java`, `.cs`, `.rb`, `.go`, `.rs`, `.html`, `.htm`

**Content Patterns:**
- Files containing `paypal.Button`, `actions.payment.create`, `actions.payment.execute`
- Script tags with checkout.js URLs
- v4 SDK URL patterns: `https://www.paypalobjects.com/api/checkout.js`

**Configuration Files:**
- Files with PayPal v4 SDK script tags or button configurations

## TypeScript Support

### Official TypeScript Definitions

PayPal v6 Web SDK includes official TypeScript definitions for type safety and developer experience.

**Source:** https://github.com/paypal/paypal-js/tree/main/packages/paypal-js/types/v6

### Key TypeScript Interfaces

```typescript
import type {
    PayPalV6Namespace,
    CreateInstanceOptions,
    SdkInstance,
    PayPalOneTimePaymentSessionOptions,
    SavePaymentSessionOptions,
    VenmoOneTimePaymentSessionOptions,
    OnApproveDataOneTimePayments,
    OnApproveDataSavePayments
} from "@paypal/paypal-js/sdk-v6";
```

**Important Type Differences:**
- **One-Time Payments**: `onApprove` returns `Promise<void>`
- **Save Payments**: `onApprove` returns `void` (no Promise)
- **Save Payments**: `orderId` parameter is forbidden
- **onCancel**: Takes no parameters
- **onError**: Takes `Error` object, not complex data structures

## Key Differences Summary

| Aspect | checkout.js v4 | PayPal v6 Web SDK |
|--------|----------------|-------------------|
| **SDK Loading** | Script tag with no explicit credentials | Script tag without credentials |
| **Credentials** | Client ID in button config | Server-side client token generation |
| **SDK Architecture** | Global `paypal` object | Instance-based SDK with `createInstance()` |
| **Payment Creation** | Client-side `actions.payment.create()` | Server-side endpoint, client calls server |
| **Payment Execution** | Client-side `actions.payment.execute()` | Server-side capture endpoint |
| **Button Rendering** | `paypal.Button.render()` | Web components with event listeners |
| **Funding Detection** | `funding: { allowed: [...] }` config | `findEligibleMethods()` API |
| **Style Configuration** | `style: { label, size, shape, color }` | Presentation modes + CSS styling |
| **Token Security** | Client ID in config | Time-limited client tokens |
| **Payment Sessions** | Direct button callbacks | Payment session objects with lifecycle methods |
| **API Access Pattern** | Direct browser-to-PayPal | Server-mediated endpoints |
| **Error Handling** | Error callbacks | Error codes with Debug IDs |
| **TypeScript Support** | No official types | Official TypeScript definitions |
| **Order Validation** | Client-side validation | Server-side validation (never trust client) |

### Key Technical Changes

**Architecture:**
- v4: Global object with direct API calls
- v6: Modular components with instance-based SDK

**Credential Management:**
- v4: Client ID in button configuration
- v6: Server-side token generation (credentials handled server-side)

**API Pattern:**
- v4: Direct browser-to-PayPal API calls
- v6: Server-mediated calls (browser → your server → PayPal)

**Token Management:**
- v4: Static client ID
- v6: Time-limited client tokens with appropriate expiration handling

**Button Rendering:**
- v4: JavaScript `paypal.Button.render()`
- v6: Web components with click handlers

## AI Assistant Behavior

- Focus on PayPal v4 to v6 Web SDK migration guidance only
- **Always detect setup before providing migration code** - use code analysis and interactive questioning
- Generate production-ready code following security best practices
- Provide complete, well-documented implementations
- Always include both client-side and server-side code
- Report migration completeness and manual steps required
- Use neutral, professional language when comparing v4 and v6
- Never describe v4 as deprecated or inferior
- **File Path Resolution**: All markdown links in this file are relative to the directory containing this rules file
- Clearly indicate framework support status before migration
- Defer React and APM migrations until official v6 support is available

