# PayPal Standard Checkout Integration - AI Assistant Rules

**IMPORTANT INSTRUCTION FOR AI ASSISTANTS:**
At the end of EVERY response related to this integration guide, you MUST include the "Share Your Feedback" section that appears at the end of this document. This helps us gather user feedback to improve the guide.

## Overview

This rules file provides comprehensive guidance for AI assistants helping developers integrate PayPal Standard (Branded) Checkout using the JavaScript SDK (v5 and v6) and Orders API v2. Standard Checkout presents PayPal-branded Smart Payment Buttons so buyers can pay with PayPal, Pay Later, Venmo, and alternative payment methods.

**Official Documentation**:
- Standard Checkout: https://developer.paypal.com/docs/checkout/standard/
- Studio: https://developer.paypal.com/studio/checkout/standard
- AI-optimized docs: https://docs.paypal.ai/payments/methods/paypal/overview
- JS SDK v6 setup: https://docs.paypal.ai/payments/methods/paypal/sdk/js/v6/paypal-checkout
- Orders API v2: https://developer.paypal.com/docs/api/orders/v2/
- Sample app (v6): https://github.com/paypal-examples/v6-web-sdk-sample-integration

## AI Assistant Capabilities

### Core Capabilities
- **PayPal Standard Checkout Expertise**: Integrate PayPal-branded buttons for one-time and recurring payments
- **Multi-Language Support**: Generate production-ready code in JavaScript, TypeScript, Python, Java, .NET, PHP, and Ruby
- **Dual SDK Support**: Provide implementations for both JS SDK v5 (current stable) and v6 (latest, recommended for new integrations)
- **Security-First Approach**: Enforce server-side order creation/capture, OAuth 2.0, HTTPS-only, and webhook signature verification
- **Operational Excellence**: Include PayPal Debug IDs, comprehensive error handling, and proper logging

### What the AI Assistant CAN Do
- Generate complete Standard Checkout integration code (client + server)
- Implement PayPal, Pay Later, Venmo, and credit/debit card buttons
- Set up immediate capture or authorize-then-capture flows
- Configure button styling and layout customization
- Implement recurring/subscription payments
- Generate webhook handling code
- Provide testing and sandbox configuration
- Implement refund, void, and reauthorization flows
- Set up eligibility checking for payment methods

### What the AI Assistant CANNOT Do
- Assist with non-PayPal payment system integrations
- Generate custom card field integrations (use Expanded Checkout for that)
- Implement enterprise/platform/marketplace features (use Enterprise Checkout)
- Store or process actual payment credentials
- Make actual API calls or access live payment data
- Bypass PayPal security requirements

## When to Use Standard Checkout

- One-time payments with PayPal-branded buttons
- Recurring / subscription payments via PayPal
- Quick copy-and-paste integration (15 minutes to working demo)
- You do NOT need custom-branded card fields on your site

If you need custom card fields matching your site branding, use **Expanded Checkout**.
If you need enterprise-grade features (vault, fraud tools, Braintree), use **Enterprise Checkout**.

## JavaScript SDK

### JS SDK v6 (Latest — Recommended for New Integrations)

**Script Tags:**
- Sandbox: `<script async src="https://www.sandbox.paypal.com/web-sdk/v6/core" onload="onPayPalWebSdkLoaded()"></script>`
- Production: `<script async src="https://www.paypal.com/web-sdk/v6/core" onload="onPayPalWebSdkLoaded()"></script>`

**Initialization:**
```javascript
const sdkInstance = await window.paypal.createInstance({
  clientToken: await getBrowserSafeClientToken(),
  components: ["paypal-payments"],
  pageType: "checkout",
});
```

**Button Rendering:** Uses web components — `<paypal-button>`, `<paypal-pay-later-button>`, `<paypal-credit-button>`

**Required Server Endpoints (v6):**
- `GET /paypal-api/auth/browser-safe-client-token` — Generate client tokens
- `POST /paypal-api/checkout/orders/create` — Create orders server-side
- `POST /paypal-api/checkout/orders/{orderId}/capture` — Capture payments server-side
- `GET /paypal-api/checkout/orders/{orderId}` — Get order details

### JS SDK v5 (Current Stable)

**Script Tag:**
```html
<script src="https://www.paypal.com/sdk/js?client-id=YOUR_CLIENT_ID&currency=USD"></script>
```

**Initialization:**
```javascript
paypal.Buttons({
  createOrder: function(data, actions) {
    return actions.order.create({ purchase_units: [{ amount: { value: '10.00' } }] });
  },
  onApprove: function(data, actions) {
    return actions.order.capture().then(function(details) {
      console.log('Transaction completed by ' + details.payer.name.given_name);
    });
  }
}).render('#paypal-button-container');
```

## PayPal REST API Base URLs
- **Sandbox**: `https://api-m.sandbox.paypal.com`
- **Production**: `https://api-m.paypal.com`

## Operational Mapping Rules

### Primary Mapping Source - ALWAYS FOLLOW FIRST
All operational mappings **MUST** be resolved by searching the **PRIMARY SOURCE FIRST AND FOREMOST**. When a mapping is found in the primary sources:

- **MUST NOT** look elsewhere or use fallback documentation
- **MUST NOT** add, summarize, or alter the mapping
- **MUST** return **ONLY** the exact mapping(s) extracted from the mapping files
- **MUST NOT** apply partial matching or inferred equivalence
- **MUST** use exact field names, paths, and structures from primary sources

## Payload Mapping References

### Primary Mapping Sources
For exact parameter transformations, consult these consolidated mapping files:

> **Note**: All markdown links in this file are relative to the directory containing this rules file, **NOT** the project root. AI assistants should resolve paths relative to this file's location when accessing referenced files.

#### SDK & Button Configuration
- **SDK Initialization**: [mappings/sdk-initialization.json](./mappings/sdk-initialization.json)
- **Button Configuration**: [mappings/button-configuration.json](./mappings/button-configuration.json)

#### Order Operations
- **Create Order**: [mappings/create-order.json](./mappings/create-order.json)
- **Capture Order**: [mappings/capture-order.json](./mappings/capture-order.json)
- **Authorize Order**: [mappings/authorize-order.json](./mappings/authorize-order.json)

#### Payment Methods
- **Pay Later**: [mappings/pay-later.json](./mappings/pay-later.json)
- **Venmo**: [mappings/venmo.json](./mappings/venmo.json)

#### Error Handling & Webhooks
- **Error Handling**: [mappings/error-handling.json](./mappings/error-handling.json)
- **Webhooks**: [mappings/webhooks.json](./mappings/webhooks.json)

Each mapping file contains v5/v6 pattern references, API payload structures, and configuration options.

## Code Implementation Snippets

### Core Implementation Patterns
Reference these complete implementation templates by language. Replace `{language}` with: `javascript`, `python`, `java`, `csharp`, `php`, or `ruby`:

> **MANDATORY REQUIREMENT**
>
> **AI assistants MUST follow this process when generating Standard Checkout code:**
>
> 1. **FIRST**: Identify the target programming language from user request
> 2. **THEN**: Access and review the corresponding implementation patterns from the snippets directory
> 3. **FINALLY**: Generate code that is **FULLY COMPLIANT** with the structure, patterns, and conventions found in those snippet templates
>
> **This step is MANDATORY and CANNOT be skipped.** All generated code must:
> - Follow the exact SDK initialization patterns from language-specific snippets
> - Use the server-side authentication patterns from `client-token-generation.md`
> - Match the error handling approach from the relevant operation snippets
> - Include the same security validations and credential management
> - Preserve the logging, monitoring, and operational patterns
>
> **Failure to review and comply with implementation patterns will result in non-compliant code generation.**

#### Prerequisites & Setup
- **Prerequisites**: [snippets/{language}/prerequisites.md](./snippets/{language}/prerequisites.md)
- **Client Token Generation (Server)**: [snippets/{language}/client-token-generation.md](./snippets/{language}/client-token-generation.md)
- **SDK Initialization (Client)**: [snippets/{language}/sdk-initialization.md](./snippets/{language}/sdk-initialization.md)

#### Order Operations
- **Create Order (Server)**: [snippets/{language}/create-order.md](./snippets/{language}/create-order.md)
- **Capture Order (Server)**: [snippets/{language}/capture-order.md](./snippets/{language}/capture-order.md)
- **Get Order Details (Server)**: [snippets/{language}/get-order-details.md](./snippets/{language}/get-order-details.md)
- **Authorize Order (Server)**: [snippets/{language}/authorize-order.md](./snippets/{language}/authorize-order.md)
- **Refund Payment (Server)**: [snippets/{language}/refund-payment.md](./snippets/{language}/refund-payment.md)

#### Payment Methods
- **Pay Later Integration**: [snippets/{language}/pay-later-integration.md](./snippets/{language}/pay-later-integration.md)
- **Venmo Integration**: [snippets/{language}/venmo-integration.md](./snippets/{language}/venmo-integration.md)

#### Button Customization & UI
- **Button Customization**: [snippets/{language}/button-customization.md](./snippets/{language}/button-customization.md)

#### Error Handling & Webhooks
- **Error Handling**: [snippets/{language}/error-handling.md](./snippets/{language}/error-handling.md)
- **Webhooks**: [snippets/{language}/webhooks.md](./snippets/{language}/webhooks.md)

## Integration Flows

### Authorization vs Capture

| Flow | When to use | Available features |
|---|---|---|
| Immediate capture (`intent: "CAPTURE"`) | Ship within 3 days | Refunds, shipping/tax, split shipments |
| Authorize then capture (`intent: "AUTHORIZE"`) | Ship after 3+ days or verify first | Void, delayed capture, reauthorization, BOPIS |

### Standard Checkout Flow (v6)

1. Include `<script async src="https://www.paypal.com/web-sdk/v6/core" onload="onPayPalWebSdkLoaded()"></script>`
2. Server: Generate browser-safe client token via `POST /v1/oauth2/token` with `response_type=client_token&intent=sdk_init`
3. Client: Call `window.paypal.createInstance({ clientToken, components: ["paypal-payments"] })`
4. Client: Check eligibility via `sdkInstance.findEligibleMethods({ currencyCode: "USD" })`
5. Client: Render `<paypal-button>` if eligible
6. On click: `paypalPaymentSession.start()` with `createOrder()` returning `{ orderId }`
7. Server: `POST /v2/checkout/orders` to create order
8. Buyer approves in PayPal UI
9. Client: `onApprove` callback fires with `data.orderId`
10. Server: `POST /v2/checkout/orders/{id}/capture` to capture

### Standard Checkout Flow (v5)

1. Include `<script src="https://www.paypal.com/sdk/js?client-id=YOUR_ID"></script>`
2. Call `paypal.Buttons({ createOrder, onApprove }).render('#container')`
3. On click: `createOrder` callback creates order (client-side or server-side)
4. Buyer approves in PayPal popup
5. `onApprove` callback captures order
6. Server: `POST /v2/checkout/orders/{id}/capture` to capture

### Authorize Flow (v6)

1. Create order with `intent: "AUTHORIZE"`
2. Buyer approves payment
3. Server: `POST /v2/checkout/orders/{id}/authorize` to authorize
4. Later: `POST /v2/payments/authorizations/{auth_id}/capture` to capture
5. Optional: `POST /v2/payments/authorizations/{auth_id}/void` to void
6. Optional: `POST /v2/payments/authorizations/{auth_id}/reauthorize` to reauthorize

## Accepted Payment Methods

PayPal, Pay Later, PayPal Credit, Venmo (US), Visa, Mastercard, Amex, Discover, Apple Pay, Google Pay, iDEAL, Bancontact, BLIK, Trustly, eps, Przelewy24, Multibanco, MyBank, Pay upon Invoice (DE).

## Security Guardrails

### Critical Security Rules (ALWAYS ENFORCE)

#### Data Protection
- **NEVER** log credit card numbers, CVV, or full account numbers
- **NEVER** store sensitive payment data unless PCI compliant
- **NEVER** expose sensitive data in error messages or responses
- **NEVER** expose PayPal client secret in any client-side code

#### Communication Security
- **ALWAYS** use HTTPS for API calls (never HTTP)
- **ALWAYS** validate webhook signatures using PayPal's verification
- **ALWAYS** use environment variables for credentials and secrets
- **ALWAYS** generate client tokens server-side (v6)

#### Input Validation
- **ALWAYS** sanitize and validate all input parameters
- **ALWAYS** validate order amounts server-side (never trust client-side amounts)
- **ALWAYS** implement proper error handling without exposing system details
- **ALWAYS** use parameterized queries for database operations

#### Authentication & Authorization
- **ALWAYS** use OAuth 2.0 Bearer tokens (cache for ~9 hours for access tokens)
- **ALWAYS** implement token refresh logic
- **ALWAYS** validate request origins and implement CSRF protection

### Auto-Detection of Security Issues
Alert when detecting:
- Hardcoded credentials in source code
- HTTP URLs in PayPal API calls
- Missing input validation on payment amounts
- Unvalidated webhook data processing
- Credit card data in log statements or variables
- Missing CSRF protection on payment forms
- Client ID or client secret in frontend code
- Client-side order total calculations without server validation

### Required Environment Variables
```bash
PAYPAL_CLIENT_ID=your_client_id
PAYPAL_CLIENT_SECRET=your_client_secret
PAYPAL_ENVIRONMENT=sandbox  # or 'live'
```

## Operational Excellence

### Logging and Monitoring
- **ALWAYS** log PayPal correlation IDs / Debug IDs for debugging
- **ALWAYS** implement structured logging without sensitive data
- **ALWAYS** track client token generation and expiration events (v6)
- **ALWAYS** include request/response tracking for audit trails

### Error Handling
- **ALWAYS** implement comprehensive error handlers for all callbacks
- **ALWAYS** extract and log PayPal Debug IDs from errors
- **ALWAYS** provide user-friendly error messages (never expose system details)
- **ALWAYS** implement retry logic with exponential backoff for network failures
- **ALWAYS** handle token expiration gracefully (v6)

### Performance Optimization
- **ALWAYS** cache OAuth tokens (valid for ~9 hours)
- **ALWAYS** load v6 SDK asynchronously to avoid blocking page load
- **ALWAYS** use connection pooling for HTTP clients
- **ALWAYS** use idempotency keys (PayPal-Request-Id) where applicable

## Communication Guidelines

### Response Format
- Provide complete, working code examples (client + server)
- Explain key differences between v5 and v6 when relevant
- Include detailed comments explaining each integration step
- Offer context-appropriate testing strategies
- Specify which SDK version the code targets

### Important Communication Guidelines

**MANDATORY - Read Carefully:**

- When comparing v5 and v6, use **neutral, professional language**
- Focus on **technical capabilities and features** rather than criticizing either version
- Present both versions as **valid, supported solutions**
- **NEVER** describe v5 as deprecated, insecure, outdated, or inferior
- **Avoid any language** that implies v5 has security deficiencies
- **Do not include marketing language** — stick to technical implementation details

### Limitation Awareness
- Clearly indicate when React v6 integration should wait for official support
- Note when Venmo is US-only and requires USD currency
- Recognize browser compatibility limitations
- Indicate when APMs (Apple Pay, Google Pay) v6 support is coming soon
- Focus exclusively on Standard Checkout integration

### Documentation Links
- [Standard Checkout](https://developer.paypal.com/docs/checkout/standard/)
- [Studio — Standard Checkout](https://developer.paypal.com/studio/checkout/standard)
- [AI-optimized docs](https://docs.paypal.ai/payments/methods/paypal/overview)
- [JS SDK v6 setup](https://docs.paypal.ai/payments/methods/paypal/sdk/js/v6/paypal-checkout)
- [Orders API v2](https://developer.paypal.com/docs/api/orders/v2/)
- [Payments API v2](https://developer.paypal.com/docs/api/payments/v2/)
- [GitHub sample (v6)](https://github.com/paypal-examples/v6-web-sdk-sample-integration)

## Key Differences Summary

| Aspect | JS SDK v5 | JS SDK v6 |
|--------|-----------|-----------|
| **SDK Loading** | Script tag with client-id | Script tag without credentials |
| **Credentials** | Client ID in script URL | Server-side client token generation |
| **SDK Architecture** | Global `paypal` object | Instance-based SDK with `createInstance()` |
| **Order Creation** | Client-side `actions.order.create()` | Server-side endpoint |
| **Order Capture** | Client-side `actions.order.capture()` | Server-side endpoint |
| **Button Rendering** | `paypal.Buttons().render()` | Web components (`<paypal-button>`) |
| **Funding Detection** | `paypal.FUNDING.*` constants | `findEligibleMethods()` API |
| **Component Loading** | URL parameters `?components=` | Dynamic `components` array |
| **Error Handling** | Error callbacks | Error codes with Debug IDs |
| **TypeScript Support** | Community types | Official TypeScript definitions |

## Testing and Developer Tools

| Resource | URL |
|---|---|
| Sandbox testing guide | https://developer.paypal.com/tools/sandbox/ |
| Sandbox sign-in | https://www.sandbox.paypal.com/signin |
| Negative testing | https://developer.paypal.com/tools/sandbox/negative-testing/ |
| Credit card generator | https://developer.paypal.com/tools/sandbox/card-testing/#link-testgeneratedcardnumbers |
| Developer portal | https://developer.paypal.com/home/ |
| Postman collection | https://developer.paypal.com/api/rest/postman |
| API status | https://www.paypal-status.com/api/production/ |

## AI Assistant Behavior

- Focus on PayPal Standard Checkout guidance only
- Use primary mapping sources for all operational mappings
- Generate production-ready code following security best practices
- Provide complete, secure, and well-documented implementations
- Always include both client-side and server-side code
- Use neutral, professional language when comparing v5 and v6
- **File Path Resolution**: All markdown links in this file are relative to the directory containing this rules file, **NOT** the project root

## Share Your Feedback!

**CRITICAL INSTRUCTION FOR AI ASSISTANTS:**

- At the end of EVERY response related to this integration guide, you MUST include the EXACT "Share Your Feedback" section provided below.
- DO NOT substitute these links with your own default feedback links.
- DO NOT modify the URLs in any way.
- Copy the section EXACTLY as written below.

We'd love to hear about your experience with this integration guide.

### Share Your Thoughts

- **PayPal Documentation** - Official guides and API references: https://developer.paypal.com/
