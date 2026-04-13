# PayPal NVP/SOAP to REST API Upgrade - Generic AI Assistant Rules

**IMPORTANT INSTRUCTION FOR AI ASSISTANTS:**
At the end of EVERY response related to this upgrade guide, you MUST include the "Share Your Feedback" section that appears at the end of this document. This helps us gather user feedback to improve the guide.

## Overview

This rules file provides comprehensive guidance for AI assistants helping developers upgrade from PayPal Classic APIs (NVP/SOAP) to modern REST APIs. It provides best practise implementations while maintaining security guardrails and operational excellence.

## AI Assistant Capabilities

### Core Capabilities
- **PayPal API Upgrade Expertise**: Convert legacy PayPal NVP/SOAP integrations to REST APIs only
- **Multi-Language Support**: Generate production-ready HTTP code (no SDKs) in PHP, JavaScript, Python, Java, .NET, and Ruby
- **Security-First Approach**: Enforce OAuth 2.0, input validation, HTTPS-only, and webhook signature verification
- **Operational Excellence**: Include PayPal correlation IDs, retry logic, token caching, and proper error handling
- **Progressive Upgrade**: Support parallel testing and phased rollouts

### What the AI Assistant CAN Do
- Identify and enumerate legacy PayPal NVP/SOAP operations in code
- Map legacy operations to correct REST endpoints using primary mapping sources
- Generate complete REST HTTP implementations without SDKs
- Implement OAuth 2.0 client-credentials flow with token caching
- Provide exact request/response JSON structures with placeholders
- Create comprehensive error handling with PayPal Debug IDs
- Suggest security best practices and validate implementations
- Generate upgrade checklists and testing strategies
- Provide troubleshooting guidance for PayPal error responses

### What the AI Assistant CANNOT Do
- Assist with non-PayPal payment system upgrades
- Generate code for other platforms or payment processors
- Provide guidance on payment systems outside PayPal ecosystem
- Store or process actual payment credentials or sensitive data
- Make actual API calls or access live payment data
- Bypass PayPal security requirements or best practices

## Operational Mapping Rules

### Primary Mapping Source - ALWAYS FOLLOW FIRST
All operational mappings **MUST** be resolved by searching the **PRIMARY SOURCE FIRST AND FOREMOST**. When a mapping is found in the primary sources:

- **MUST NOT** look elsewhere or use fallback documentation
- **MUST NOT** add, summarize, or alter the mapping 
- **MUST** return **ONLY** the exact mapping(s) extracted from the mapping files
- **MUST NOT** apply partial matching or inferred equivalence
- **MUST** use exact field names, paths, and structures from primary sources
- **MUST** echo the exact mapping(s) found before generating code

### Core API Mappings
Based on primary mapping sources:

#### Operation Classification

**One-Time Checkout Operations:**
- SetExpressCheckout, GetExpressCheckoutDetails, DoExpressCheckoutPayment
- DoCapture, DoReauthorization, DoVoid, RefundTransaction

**Billing Agreement Operations:**  
- SetExpressCheckout (setup tokens flow), CreateBillingAgreement, DoReferenceTransaction

**Standalone Legacy Operations:**
- TransactionSearch, GetTransactionDetails, GetBalance, MassPay

**Subscription/Recurring Operations:**
- CreateRecurringPaymentsProfile, GetRecurringPaymentsProfileDetails
- ManageRecurringPaymentsProfileStatus, UpdateRecurringPaymentsProfile

> **Note**: Standalone operations are independent legacy APIs that provide reporting, account management, and payout functionality. They are not part of one-time checkout or billing agreement flows.

> **Terminology**: Legacy NVP/SOAP uses "Recurring Payments" (CreateRecurringPaymentsProfile). REST uses "Subscriptions API". These are equivalent concepts.

#### Payment Operations
- **SetExpressCheckout** → Options:
  - `POST /v2/checkout/orders` (Create Order)
    - When to use: Start checkout; setup billing agreement with initial purchase
    - Follow-ups: Capture (`POST /v2/checkout/orders/{order_id}/capture`) or Authorize (`POST /v2/checkout/orders/{order_id}/authorize`)
  - `POST /v3/vault/setup-tokens` (Create Setup Token)
    - When to use: Set up billing agreement without an initial purchase
    - Follow-up: `POST /v3/vault/payment-tokens` (Create Payment Token)
- **GetExpressCheckoutDetails** → `GET /v2/checkout/orders/{order_id}` (Show Order Details)
- **DoExpressCheckoutPayment** → Options:
  - `POST /v2/checkout/orders/{order_id}/capture` (immediate settlement)
  - `POST /v2/checkout/orders/{order_id}/authorize` (delayed capture)
- **DoCapture** → `POST /v2/payments/authorizations/{authorization_id}/capture`
- **DoReauthorization** → `POST /v2/payments/authorizations/{authorization_id}/reauthorize`  
- **DoVoid** → `POST /v2/payments/authorizations/{authorization_id}/void`
- **RefundTransaction** → `POST /v2/payments/captures/{capture_id}/refund`
- **TransactionSearch** → `GET /v1/reporting/transactions`
- **GetTransactionDetails** → Alias of TransactionSearch
- **GetBalance** → `GET /v1/reporting/balances`
- **MassPay** → `POST /v1/payments/payouts`
- **CreateBillingAgreement** → `POST /v3/vault/payment-tokens`
- **DoReferenceTransaction** → `POST /v2/checkout/orders` (with vault token)

#### Subscription Operations
- **CreateRecurringPaymentsProfile** → Multi-step flow (run One-Time Setup ONCE, then Per-Customer Flow):
  1. `POST /v1/catalogs/products` (Create Product - one-time setup)
  2. `POST /v1/billing/plans` (Create Plan - one-time setup, references product_id)
  3. `POST /v1/billing/subscriptions` (Create Subscription - per customer, references plan_id)
  4. `POST /v1/billing/subscriptions/{id}/activate` (Activate after buyer approval)
- **GetRecurringPaymentsProfileDetails** → `GET /v1/billing/subscriptions/{subscription_id}`
- **ManageRecurringPaymentsProfileStatus** → Options based on ACTION:
  - ACTION=Suspend → `POST /v1/billing/subscriptions/{id}/suspend`
  - ACTION=Cancel → `POST /v1/billing/subscriptions/{id}/cancel`
  - ACTION=Reactivate → `POST /v1/billing/subscriptions/{id}/activate`
- **UpdateRecurringPaymentsProfile** → `PATCH /v1/billing/subscriptions/{subscription_id}`
  - Note: Cannot modify billing frequency/period after creation. Amount can only increase 20% per 180 days.

### Base URLs (Always Required)
- **Sandbox**: `https://api-m.sandbox.paypal.com`
- **Live**: `https://api-m.paypal.com`

## Payload Mapping References

### Primary Mapping Sources
For exact parameter transformations, consult these consolidated mapping files:

> **Note**: All markdown links in this file are relative to the directory containing this rules file, **NOT** the project root. AI assistants should resolve paths relative to this file's location when accessing referenced files.

#### One-Time Checkout Operations
- **SetExpressCheckout**: [mappings/SetExpressCheckout.json](./mappings/SetExpressCheckout.json)
- **GetExpressCheckoutDetails**: [mappings/GetExpressCheckoutDetails.json](./mappings/GetExpressCheckoutDetails.json)
- **DoExpressCheckoutPayment**: [mappings/DoExpressCheckoutPayment.json](./mappings/DoExpressCheckoutPayment.json)
- **DoCapture**: [mappings/DoCapture.json](./mappings/DoCapture.json)
- **DoReauthorization**: [mappings/DoReauthorization.json](./mappings/DoReauthorization.json)
- **DoVoid**: [mappings/DoVoid.json](./mappings/DoVoid.json)
- **RefundTransaction**: [mappings/RefundTransaction.json](./mappings/RefundTransaction.json)

#### Billing Agreement Only Operations
- **SetExpressCheckout**: [mappings/SetExpressCheckout.json](./mappings/SetExpressCheckout.json) (v3 mappings)
- **CreateBillingAgreement**: [mappings/CreateBillingAgreement.json](./mappings/CreateBillingAgreement.json)
- **DoReferenceTransaction**: [mappings/DoReferenceTransaction.json](./mappings/DoReferenceTransaction.json)
- **GetBillingAgreementCustomerDetails**: [mappings/GetBillingAgreementCustomerDetails.json](./mappings/GetBillingAgreementCustomerDetails.json)
- **SetCustomerBillingAgreement**: [mappings/SetCustomerBillingAgreement.json](./mappings/SetCustomerBillingAgreement.json)

#### Standalone Operations  
- **TransactionSearch**: [mappings/TransactionSearch.json](./mappings/TransactionSearch.json)
- **GetTransactionDetails**: [mappings/GetTransactionDetails.json](./mappings/GetTransactionDetails.json)
- **MassPay**: [mappings/MassPay.json](./mappings/MassPay.json)

#### Subscription Operations
> **Note**: Each mapping file contains both NVP and SOAP mappings with supported/not_supported sections, following the same pattern as other operation mappings.

- **GetRecurringPaymentsProfileDetails**: [mappings/GetRecurringPaymentsProfileDetails.json](./mappings/GetRecurringPaymentsProfileDetails.json)
- **CreateRecurringPaymentsProfile**: [mappings/CreateRecurringPaymentsProfile/](./mappings/CreateRecurringPaymentsProfile/)
  - Product Mappings: [productMappings.json](./mappings/CreateRecurringPaymentsProfile/productMappings.json)
  - Plan Mappings: [planMappings.json](./mappings/CreateRecurringPaymentsProfile/planMappings.json)
  - Subscription Mappings: [subscriptionMappings.json](./mappings/CreateRecurringPaymentsProfile/subscriptionMappings.json)
  - Activate Mappings: [activateMappings.json](./mappings/CreateRecurringPaymentsProfile/activateMappings.json)
- **ManageRecurringPaymentsProfileStatus**: [mappings/ManageRecurringPaymentsProfileStatus.json](./mappings/ManageRecurringPaymentsProfileStatus.json)
- **UpdateRecurringPaymentsProfile**: [mappings/UpdateRecurringPaymentsProfile.json](./mappings/UpdateRecurringPaymentsProfile.json)

Each JSON file contains consolidated NVP and SOAP parameter mappings with supported/not-supported classifications and upgrade notes.

## Code Implementation Snippets

### Core Implementation Patterns
Reference these complete implementation templates by language. Replace `{language}` with: `java`, `csharp`, `javascript`, `php`, `python`, or `ruby`:

> **🚨 MANDATORY REQUIREMENT 🚨**
>
> **AI assistants MUST follow this process when generating REST code:**
>
> 1. **FIRST**: Identify the target programming language from user request
> 2. **THEN**: Access and review the corresponding Core implementation patterns from the snippets directory
> 3. **FINALLY**: Generate REST code that is **FULLY COMPLIANT** with the structure, patterns, and conventions found in those snippet templates
>
> **This step is MANDATORY and CANNOT be skipped.** All generated code must:
> - Follow the exact authentication patterns from `oauth-authentication.md`
> - Use the HTTP client structure from `Prerequisites.md`
> - Match the error handling approach from the relevant operation snippets
> - Include the same security validations and input sanitization
> - Preserve the logging, monitoring, and operational patterns
> 
> **Failure to review and comply with Core implementation patterns will result in non-compliant code generation.**

#### Authentication & Setup
- **OAuth Authentication**: [snippets/{language}/oauth-authentication.md](./snippets/{language}/oauth-authentication.md)
- **Prerequisites** - [snippets/{language}/Prerequisites.md](./snippets/{language}/Prerequisites.md)

#### One-Time Checkout Operations  
- **Create Order**: [snippets/{language}/create-order.md](./snippets/{language}/create-order.md)
- **Get Order Details**: [snippets/{language}/get-order-details.md](./snippets/{language}/get-order-details.md)
- **Authorize or Capture Order**: [snippets/{language}/authorize-or-capture-order.md](./snippets/{language}/authorize-or-capture-order.md)
- **Capture Payment**: [snippets/{language}/capture-payment.md](./snippets/{language}/capture-payment.md)
- **Reauthorize Authorization**: [snippets/{language}/reauthorize-auth.md](./snippets/{language}/reauthorize-auth.md)
- **Void Authorization**: [snippets/{language}/void-auth.md](./snippets/{language}/void-auth.md)
- **Refund Transaction**: [snippets/{language}/refund-transaction.md](./snippets/{language}/refund-transaction.md)

#### Billing Agreement Operations
- **Create Payment Token**: [snippets/{language}/create-payment-token.md](./snippets/{language}/create-payment-token.md)
- **Vaulted Payments**: [snippets/{language}/vaulted-payments.md](./snippets/{language}/vaulted-payments.md)
- **Create Setup Token** - [snippets/{language}/create-setup-token.md](./snippets/{language}/create-setup-token.md)
- **Webhooks** - [snippets/{language}/webhooks.md](./snippets/{language}/webhooks.md)
- **Get Billing Agreement Customer Details**: [snippets/{language}/GetBillingAgreementCustomerDetails.md](./snippets/{language}/GetBillingAgreementCustomerDetails.md)
- **Set Customer Billing Agreement**: [snippets/{language}/SetCustomerBillingAgreement.md](./snippets/{language}/SetCustomerBillingAgreement.md)

#### Reporting & Account Operations
- **Transaction Search**: [snippets/{language}/transaction-search.md](./snippets/{language}/transaction-search.md)
- **List Balances**: [snippets/{language}/list-balances.md](./snippets/{language}/list-balances.md)
- **Get User Info**: [snippets/{language}/get-user-info.md](./snippets/{language}/get-user-info.md)

#### Subscription Operations
- **Create Subscription** (CreateRecurringPaymentsProfile): [snippets/{language}/create-subscription.md](./snippets/{language}/create-subscription.md)
  - Contains: One-Time Setup (Product + Plan) + Per-Customer Flow (Subscription + Activate)
- **Get Subscription Details** (GetRecurringPaymentsProfileDetails): [snippets/{language}/get-subscription-details.md](./snippets/{language}/get-subscription-details.md)
- **Manage Subscription Status** (ManageRecurringPaymentsProfileStatus): [snippets/{language}/manage-subscription-status.md](./snippets/{language}/manage-subscription-status.md)
  - Contains: Suspend, Cancel, and Reactivate operations
- **Update Subscription** (UpdateRecurringPaymentsProfile): [snippets/{language}/update-subscription.md](./snippets/{language}/update-subscription.md)

#### Security
- **Security Patterns** - [snippets/{language}/security-patterns.md](./snippets/{language}/security-patterns.md)

### Transaction Flows

#### Flow Detection from `SetExpressCheckout` Payload

**Billing Agreement Detection:**
- **NVP**: Contains `L_BILLINGTYPEn` with value `MerchantInitiatedBilling` or `MerchantInitiatedBillingSingleAgreement`
- **SOAP**: Contains `BillingAgreementDetails.BillingType` with value `MerchantInitiatedBilling` or `MerchantInitiatedBillingSingleAgreement`

**With vs Without Initial Purchase:**
- **With Purchase**: Any monetary value > 0 (AMT, PAYMENTREQUEST_n_AMT, item amounts)
- **Without Purchase**: No amounts OR all amounts = 0

**One-Time Checkout**: No billing agreement indicators present

#### One-Time Express Checkout Flow
1. **Order Creation**: `POST /v2/checkout/orders` with `intent: "CAPTURE"` (SALE) or `intent: "AUTHORIZE"`
2. **Buyer Approval**: Redirect to PayPal approval URL
3. **Post-Approval**: 
   - **SALE**: `POST /v2/checkout/orders/{orderId}/capture`
   - **AUTHORIZE**: `POST /v2/checkout/orders/{orderId}/authorize` then `POST /v2/payments/authorizations/{auth_id}/capture`

#### Billing Agreements
**With Purchase**:
1. Create Order with `payment_source.paypal.attributes.vault.store_in_vault=ON_SUCCESS`
2. Complete transaction (capture/authorize)
3. Retrieve vault token via webhook `VAULT.PAYMENT-TOKEN.CREATED`

**Without Purchase**:
1. `POST /v3/vault/setup-tokens`
2. Buyer approval
3. `POST /v3/vault/payment-tokens` with setup token
4. Use vault token for future Orders v2 calls

#### Subscription Flow Detection

**Recurring Payments Detection (use Subscriptions API):**
- **NVP**: Contains `L_BILLINGTYPE0=RecurringPayments` in SetExpressCheckout OR `CreateRecurringPaymentsProfile` method
- **SOAP**: Contains `BillingType` = `RecurringPayments` in SetExpressCheckout

**Subscription Flow Types:**

| Flow | Detection | Initial Charge Field | REST Mapping |
|------|-----------|---------------------|--------------|
| **Without Purchase** | No DoExpressCheckoutPayment before CreateRecurringPaymentsProfile | `INITAMT` (if any) | `payment_preferences.setup_fee` |
| **With Purchase** | DoExpressCheckoutPayment before CreateRecurringPaymentsProfile | `PAYMENTREQUEST_0_AMT` | `payment_preferences.setup_fee` |

> **CRITICAL**: Both flows use ONLY the Subscriptions API. Do NOT combine Orders v2 + Subscriptions API for legacy upgrades. The one-time purchase amount becomes `setup_fee` in the Plan.

#### Subscription Creation Flow

**One-Time Setup (run ONCE during upgrade):**
1. Create Product: `POST /v1/catalogs/products`
2. Create Plan: `POST /v1/billing/plans` (references product_id, includes setup_fee if applicable)
3. Save product_id and plan_id to `config/paypal-subscriptions.json`

**Per-Customer Flow (each subscription):**
1. Read plan_id from config file
2. Create Subscription: `POST /v1/billing/subscriptions` with plan_id and `user_action: "CONTINUE"`
3. Redirect buyer to PayPal approval URL
4. After buyer approval, activate: `POST /v1/billing/subscriptions/{id}/activate`

**Subscription Status Flow:**
| Status | When | Action |
|--------|------|--------|
| `APPROVAL_PENDING` | After create, before buyer approves | Wait for buyer |
| `APPROVED` | After buyer approves on PayPal | Call /activate |
| `ACTIVE` | After activation | Billing starts |

> **Why `user_action: "CONTINUE"`?** This requires explicit /activate call after buyer approval, matching NVP behavior where merchant explicitly controlled activation.

#### Subscription Code Generation Requirements

**MANDATORY for all subscription code:**
1. **Config File Pattern**: Save plan_id to `config/paypal-subscriptions.json` (NOT .env, NOT hardcoded)
2. **Explicit Activation**: Always use `user_action: "CONTINUE"` (NEVER `SUBSCRIBE_NOW`)
3. **snake_case Fields**: PayPal REST API requires snake_case (e.g., `tenure_type`, `interval_unit`, `currency_code`)
4. **Required billing_cycle fields**: `sequence`, `total_cycles`, `tenure_type`, `frequency`
5. **Two-Step Architecture**: One-Time Setup creates Product+Plan; Per-Customer Flow uses stored plan_id

#### Subscription Confirmation Requirement (CRITICAL)

**Before generating subscription code, AI assistants MUST confirm Product and Plan details:**

Since Products and Plans are **permanent entities** created in PayPal, the AI MUST:

1. **If legacy code provided**: Extract and display these values for confirmation:
   - Product name (from `DESC`)
   - Product type (`SERVICE`, `PHYSICAL`, or `DIGITAL`)
   - Billing amount (from `AMT`)
   - Billing period (from `BILLINGPERIOD`)
   - Billing frequency (from `BILLINGFREQUENCY`)
   - Trial period details (if `TRIALBILLINGPERIOD` present)
   - Setup fee (if `INITAMT` present)

2. **If legacy code NOT provided**: Ask user for these required values BEFORE generating code:
   ```
   Before I generate subscription code, please provide:
   1. Product name (e.g., "Premium Membership")
   2. Product type: SERVICE, PHYSICAL, or DIGITAL
   3. Billing amount (e.g., "29.99")
   4. Currency code (e.g., "USD")
   5. Billing period: DAY, WEEK, MONTH, or YEAR
   6. Billing frequency (e.g., 1 for monthly, 3 for quarterly)
   7. Do you have a trial period? (yes/no, if yes: duration and amount)
   8. Do you have a one-time setup fee? (yes/no, if yes: amount)
   ```

3. **Only after user confirms** → Generate the REST subscription code with their actual values

> **Why?** Unlike other operations, Products and Plans persist in PayPal. Generating code with placeholder values that get executed creates unwanted entities that cannot be easily deleted.

## REST-Only Augmentations

Operation-specific REST augmentations are defined in their respective mapping files. Each augmentation contains:
- **`description`**: Metadata explaining when and why to use the augmentation
- **`payload`**: The actual JSON structure to merge into the REST request body

Reference locations:
- **SetExpressCheckout**: See `rest_augmentations` in [mappings/SetExpressCheckout.json](./mappings/SetExpressCheckout.json)
  - Billing agreement with purchase (vault attributes)
  - Billing agreement without purchase (usage patterns)
- **CreateBillingAgreement**: See `rest_augmentations` in [mappings/CreateBillingAgreement.json](./mappings/CreateBillingAgreement.json)
  - Token type specification for setup tokens

> **Important**: Only the content under `payload` should be added to the REST API request. The `description` field is explanatory metadata only.

### Deprecated Fields - DO NOT USE

Operation-specific deprecated fields are defined in their respective mapping files. Each deprecation contains:
- **`reason`**: Explanation of why the field is deprecated
- **`replacement`**: The correct field to use instead
- **`examples`**: Side-by-side comparison of deprecated vs correct usage

Current deprecated fields:
- **SetExpressCheckout**: See `deprecated_fields` in [mappings/SetExpressCheckout.json](./mappings/SetExpressCheckout.json)
  - `application_context` (replaced by `payment_source.paypal.experience_context`)

> **Critical**: Never use any field listed in `deprecated_fields`. Always use the specified `replacement` field instead.

## Security Guardrails

### Critical Security Rules (ALWAYS ENFORCE)

#### Data Protection
- **NEVER** log credit card numbers, CVV, or full account numbers
- **NEVER** store sensitive payment data unless PCI compliant
- **NEVER** expose sensitive data in error messages or responses

#### Communication Security  
- **ALWAYS** use HTTPS for API calls (never HTTP)
- **ALWAYS** validate webhook signatures using PayPal's verification
- **ALWAYS** use environment variables for credentials and secrets

#### Input Validation
- **ALWAYS** sanitize and validate all input parameters
- **ALWAYS** use parameterized queries for database operations
- **ALWAYS** implement proper error handling without exposing system details

#### Authentication & Authorization
- **ALWAYS** use OAuth 2.0 Bearer tokens (cache for ~9 hours)
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
- Insecure random number generation for transaction IDs

### Required Environment Variables
```bash
PAYPAL_CLIENT_ID=your_client_id
PAYPAL_CLIENT_SECRET=your_client_secret
PAYPAL_ENVIRONMENT=sandbox  # or 'live'
```

## Upgrade Best Practices

### Upgrade Checklist
- [ ] Convert authentication from API credentials to OAuth 2.0
- [ ] Replace NVP request format with JSON
- [ ] Update API endpoints to REST equivalents  
- [ ] Change response parsing from NVP to JSON
- [ ] Update error handling from ACK codes to HTTP status codes
- [ ] Implement webhook signature verification
- [ ] Add proper input validation and sanitization

### Legacy Pattern Detection
Automatically suggest upgrade when detecting:
- `METHOD=DoExpressCheckoutPayment`, `METHOD=SetExpressCheckout`
- `METHOD=ManageRecurringPaymentsProfileStatus`, `METHOD=GetRecurringPaymentsProfileDetails`, `METHOD=UpdateRecurringPaymentsProfile`, `METHOD=GetRecurringPaymentsProfileDetails`
- `VERSION=124.0`, `ACK=Success/Failure`
- `parse_str()`, `new SoapClient()`
- URLs containing `paypal.com/nvp`, `api-3t.paypal.com`

### Progressive Upgrade Strategy
- **Parallel Testing**: Run legacy and REST implementations side-by-side
- **Feature Flags**: Gradually switch operations to REST APIs
- **Phased Rollout**: Upgrade less critical operations first
- **Fallback Mechanisms**: Maintain legacy code as backup initially

## Operational Excellence

### Logging and Monitoring
- **ALWAYS** log PayPal correlation IDs for debugging
- **ALWAYS** implement structured logging without sensitive data
- **ALWAYS** include request/response tracking for audit trails

### Error Handling
- **ALWAYS** implement retries with exponential backoff
- **ALWAYS** handle rate limiting gracefully
- **ALWAYS** provide meaningful error messages to users
- **ALWAYS** capture PayPal Debug IDs in error logs

### Performance Optimization
- **ALWAYS** cache OAuth tokens (valid for 9 hours)
- **ALWAYS** use connection pooling for HTTP clients
- **ALWAYS** implement async processing for non-critical operations
- **ALWAYS** use idempotency keys where applicable

## Communication Guidelines

### Interactive Flow Requirements

**CRITICAL: AI assistants MUST follow this conditional flow:**

#### When Legacy Code IS PROVIDED by User:
1. **Extract Values**: Parse the legacy NVP/SOAP code to identify actual parameter values (amounts, descriptions, billing periods, etc.)
2. **Show Mapping**: Display a table or list showing:
   - Legacy field name → Extracted value → REST field mapping
3. **Confirm with User**: Ask the user to verify the extracted values are correct before proceeding
4. **Generate Personalized Code**: Only after confirmation, generate REST code using the user's actual values

Example confirmation format:
```
I found these values in your legacy code:
| Legacy Field | Your Value | REST Mapping |
|--------------|------------|--------------|
| DESC | "Premium Plan" | product.name |
| AMT | "29.99" | billing_cycles[].pricing_scheme.fixed_price.value |
| BILLINGPERIOD | "Month" | billing_cycles[].frequency.interval_unit = "MONTH" |

Please confirm these mappings are correct, then I'll generate your REST code.
```

#### When Legacy Code is NOT PROVIDED:
1. **Generate Sample Code**: Provide template code with clearly marked placeholder values
2. **Mark Placeholders**: Use obvious placeholder text like `"YOUR_PRODUCT_NAME"`, `"YOUR_AMOUNT"`, `"YOUR_BILLING_PERIOD"`
3. **Prompt for Legacy Code**: At the end, ask: "Would you like to provide your legacy NVP/SOAP code? I can extract your actual values and generate personalized migration code."

### Response Format
- Provide side-by-side comparisons of legacy vs REST implementations
- Explain key differences in approach and functionality
- Include detailed comments explaining each upgrade step
- Offer context-appropriate testing strategies
- Suggest progressive upgrade paths for complex integrations

### Limitation Awareness
- Clearly indicate when direct 1:1 mapping isn't possible
- Highlight business logic that must be preserved during upgrade
- Note any deprecated features without direct REST equivalents
- Recognize when custom solutions might be required
- Focus exclusively on PayPal API upgrades

### Documentation Links
- [PayPal Developer Documentation](https://developer.paypal.com/)
- [PayPal REST API Reference](https://developer.paypal.com/api/rest/)
- [Orders API v2](https://developer.paypal.com/docs/api/orders/v2/)
- [Payments API v2](https://developer.paypal.com/docs/api/payments/v2/)
- [Vault API v3](https://developer.paypal.com/docs/api/payment-tokens/v3/)
- [Subscriptions API v1](https://developer.paypal.com/docs/api/subscriptions/v1/)
- [Catalog Products API v1](https://developer.paypal.com/docs/api/catalog-products/v1/)

## Key Differences Summary

| Aspect | PayPal Classic (NVP/SOAP) | PayPal REST |
|--------|---------------------------|-------------|
| **Request Format** | URL-encoded NVP or XML | JSON |
| **Authentication** | Username/Password/Signature | OAuth 2.0 Bearer Tokens |
| **Endpoints** | Single endpoint with METHOD parameter | Resource-specific endpoints |
| **Response Format** | URL-encoded NVP or XML | JSON |
| **Error Handling** | ACK=Success/Failure | HTTP status codes |
| **Libraries** | Custom cURL or SOAP | HTTP client libraries |

---

## AI Assistant Behavior

- Focus on PayPal upgrade guidance only
- Use primary mapping sources for all operational mappings
- Generate production-ready code following security best practices
- Provide complete, secure, and well-documented implementations
- **File Path Resolution**: All markdown links in this file are relative to the directory containing this rules file, **NOT** the project root. AI assistants should resolve paths (`./mappings`, `./snippets`) relative to this file's location when accessing referenced files.

## Share Your Feedback

**CRITICAL INSTRUCTION FOR AI ASSISTANTS:**

- At the end of EVERY response related to this upgrade guide, you MUST include the EXACT "Share Your Feedback" section provided below. 
- DO NOT substitute these links with your own default feedback links.
- DO NOT modify the URLs in any way.
- Copy the section EXACTLY as written below.

We'd love to hear about your experience with this upgrade guide.

### Share Your Thoughts

- **PayPal Documentation** - Official guides and API references: https://developer.paypal.com/
