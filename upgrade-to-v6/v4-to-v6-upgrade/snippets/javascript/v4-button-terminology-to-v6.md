# V4 Button Terminology → V6 Equivalents

Complete mapping of all checkout.js v4 button labels, funding sources, and terminology to v6 JS SDK equivalents.

**Official Sources:**
- [PayPal checkout.js v4 GitHub Repository](https://github.com/paypal/paypal-checkout-components/tree/v4)
- [PayPal JS SDK Documentation](https://developer.paypal.com/sdk/js/)

---

## Button Label Mappings

### 1. Standard PayPal Button (`label: 'paypal'`)

**V4 Implementation:**
```javascript
// checkout.js v4
paypal.Button.render({
    env: 'sandbox',
    client: {
        sandbox: 'your_sandbox_client_id'
    },
    style: {
        label: 'paypal',    // "PayPal" button with logo
        size: 'medium',
        shape: 'rect',
        color: 'gold'
    },
    payment: function(data, actions) {
        return actions.payment.create({
            payment: {
                transactions: [{
                    amount: { total: '10.00', currency: 'USD' }
                }]
            }
        });
    },
    onAuthorize: function(data, actions) {
        return actions.payment.execute();
    }
}, '#paypal-button');
```

**V6 Equivalent:**
```javascript
// JS SDK v6
const clientToken = await fetch('/api/paypal/client-token').then(r => r.json());

const sdk = await window.paypal.createInstance({
    clientToken: clientToken.token,
    components: ['paypal-payments'],
    pageType: 'checkout'
});

const paypalSession = sdk.createPayPalOneTimePaymentSession({
    createOrder: async () => {
        const response = await fetch('/api/orders', { method: 'POST' });
        const order = await response.json();
        return order.id;
    },
    onApprove: async (data) => {
        const response = await fetch(`/api/orders/${data.orderID}/capture`, {
            method: 'POST'
        });
        return response.json();
    }
});

await paypalSession.render('#paypal-button');
```

**Migration Notes:**
- V6 removes `label` option - buttons follow PayPal branding
- All API calls must be server-side in v6
- V6 uses client token for authentication

---

### 2. Checkout Button (`label: 'checkout'`)

**V4 Implementation:**
```javascript
// checkout.js v4
paypal.Button.render({
    style: {
        label: 'checkout',  // "Checkout" button with logo
        size: 'large',
        color: 'blue'
    },
    payment: function(data, actions) {
        return actions.payment.create({
            payment: {
                transactions: [{ amount: { total: '25.00', currency: 'USD' } }]
            }
        });
    },
    onAuthorize: function(data, actions) {
        return actions.payment.execute();
    }
}, '#checkout-button');
```

**V6 Equivalent:**
```javascript
// JS SDK v6 - Same as standard PayPal button
const paypalSession = sdk.createPayPalOneTimePaymentSession({
    createOrder: async () => {
        const response = await fetch('/api/orders', { method: 'POST' });
        return (await response.json()).id;
    },
    onApprove: async (data) => {
        await fetch(`/api/orders/${data.orderID}/capture`, { method: 'POST' });
    }
});

await paypalSession.render('#paypal-button');
```

**Migration Notes:**
- `label: 'checkout'` was just a text variant in v4
- V6 uses standard PayPal button (no label customization)
- Functionality is identical to `label: 'paypal'`

---

### 3. Buy Now Button (`label: 'buynow'`)

**V4 Implementation:**
```javascript
// checkout.js v4
paypal.Button.render({
    style: {
        label: 'buynow',    // "Buy Now" button
        size: 'medium',
        shape: 'pill',
        color: 'gold'
    },
    payment: function(data, actions) {
        return actions.payment.create({
            payment: {
                transactions: [{
                    amount: { total: '99.99', currency: 'USD' }
                }]
            }
        });
    },
    onAuthorize: function(data, actions) {
        return actions.payment.execute();
    }
}, '#buynow-button');
```

**V6 Equivalent:**
```javascript
// JS SDK v6 - Same as standard PayPal button
const paypalSession = sdk.createPayPalOneTimePaymentSession({
    createOrder: async () => {
        const response = await fetch('/api/orders', { method: 'POST' });
        return (await response.json()).id;
    },
    onApprove: async (data) => {
        await fetch(`/api/orders/${data.orderID}/capture`, { method: 'POST' });
    }
});

await paypalSession.render('#paypal-button');
```

**Migration Notes:**
- `label: 'buynow'` was just a text variant in v4
- V6 uses standard PayPal button (no label customization)
- Use case context (immediate purchase) handled by your application logic

---

### 4. Pay Button (`label: 'pay'`)

**V4 Implementation:**
```javascript
// checkout.js v4
paypal.Button.render({
    style: {
        label: 'pay',       // "Pay with PayPal" or "Pay"
        size: 'small',
        color: 'silver'
    },
    payment: function(data, actions) {
        return actions.payment.create({
            payment: {
                transactions: [{ amount: { total: '15.50', currency: 'USD' } }]
            }
        });
    },
    onAuthorize: function(data, actions) {
        return actions.payment.execute();
    }
}, '#pay-button');
```

**V6 Equivalent:**
```javascript
// JS SDK v6 - Same as standard PayPal button
const paypalSession = sdk.createPayPalOneTimePaymentSession({
    createOrder: async () => {
        const response = await fetch('/api/orders', { method: 'POST' });
        return (await response.json()).id;
    },
    onApprove: async (data) => {
        await fetch(`/api/orders/${data.orderID}/capture`, { method: 'POST' });
    }
});

await paypalSession.render('#paypal-button');
```

**Migration Notes:**
- `label: 'pay'` was a generic payment label in v4
- V6 uses standard PayPal button
- All label variants map to the same v6 session type

---

### 5. Credit/Pay Later Button (`label: 'credit'`)

**V4 Implementation:**
```javascript
// checkout.js v4 - PayPal Credit
paypal.Button.render({
    style: {
        label: 'credit',    // PayPal Credit button
        size: 'medium',
        color: 'darkblue'
    },
    payment: function(data, actions) {
        return actions.payment.create({
            payment: {
                transactions: [{ amount: { total: '299.99', currency: 'USD' } }]
            }
        });
    },
    onAuthorize: function(data, actions) {
        return actions.payment.execute();
    }
}, '#credit-button');
```

**V6 Equivalent:**
```javascript
// JS SDK v6 - Pay Later (requires eligibility check)
const clientToken = await fetch('/api/paypal/client-token').then(r => r.json());

const sdk = await window.paypal.createInstance({
    clientToken: clientToken.token,
    components: ['paypal-payments'],  // Pay Later is part of paypal-payments
    pageType: 'checkout'
});

// REQUIRED: Check eligibility first
const eligibleMethods = await sdk.findEligibleMethods();

if (eligibleMethods.payLater.isEligible) {
    const payLaterSession = sdk.createPayLaterOneTimePaymentSession({
        createOrder: async () => {
            const response = await fetch('/api/orders', { method: 'POST' });
            return (await response.json()).id;
        },
        onApprove: async (data) => {
            await fetch(`/api/orders/${data.orderID}/capture`, { method: 'POST' });
        }
    });

    await payLaterSession.render('#paylater-button');
} else {
    console.log('Pay Later not available for this transaction');
}
```

**Migration Notes:**
- **Terminology Change:** V4 "Credit" → V6 "Pay Later"
- **Eligibility Required:** Must check `findEligibleMethods()` before rendering
- V6 requires same component as PayPal (`paypal-payments`)
- Eligibility depends on amount, currency, buyer location, merchant settings

---

## Funding Source Mappings

### 1. FUNDING.PAYPAL

**V4 Implementation:**
```javascript
// checkout.js v4 - PayPal funding (always enabled)
paypal.Button.render({
    funding: {
        allowed: [paypal.FUNDING.PAYPAL],  // Redundant - always enabled
        disallowed: []
    },
    payment: function(data, actions) {
        return actions.payment.create({
            payment: {
                transactions: [{ amount: { total: '50.00', currency: 'USD' } }]
            }
        });
    },
    onAuthorize: function(data, actions) {
        return actions.payment.execute();
    }
}, '#paypal-button');
```

**V6 Equivalent:**
```javascript
// JS SDK v6 - PayPal is always available (no explicit configuration needed)
const paypalSession = sdk.createPayPalOneTimePaymentSession({
    createOrder: async () => {
        const response = await fetch('/api/orders', { method: 'POST' });
        return (await response.json()).id;
    },
    onApprove: async (data) => {
        await fetch(`/api/orders/${data.orderID}/capture`, { method: 'POST' });
    }
});

await paypalSession.render('#paypal-button');
```

**Migration Notes:**
- PayPal funding is always available in both v4 and v6
- No configuration needed in v6

---

### 2. FUNDING.CREDIT (PayPal Credit / Pay Later)

**V4 Implementation:**
```javascript
// checkout.js v4 - Enable PayPal Credit
paypal.Button.render({
    funding: {
        allowed: [paypal.FUNDING.CREDIT],  // Enable Credit button
        disallowed: []
    },
    style: {
        label: 'credit',  // Usually used with credit funding
        color: 'darkblue'
    },
    payment: function(data, actions) {
        return actions.payment.create({
            payment: {
                transactions: [{ amount: { total: '500.00', currency: 'USD' } }]
            }
        });
    },
    onAuthorize: function(data, actions) {
        return actions.payment.execute();
    }
}, '#credit-button');
```

**V6 Equivalent:**
```javascript
// JS SDK v6 - Pay Later with eligibility check
const sdk = await window.paypal.createInstance({
    clientToken: clientToken.token,
    components: ['paypal-payments'],
    pageType: 'checkout'
});

const eligibleMethods = await sdk.findEligibleMethods();

if (eligibleMethods.payLater.isEligible) {
    // Get Pay Later product details
    const payLaterDetails = await eligibleMethods.payLater.getDetails();
    console.log('Available products:', payLaterDetails.products);

    const payLaterSession = sdk.createPayLaterOneTimePaymentSession({
        createOrder: async () => {
            const response = await fetch('/api/orders', { method: 'POST' });
            return (await response.json()).id;
        },
        onApprove: async (data) => {
            await fetch(`/api/orders/${data.orderID}/capture`, { method: 'POST' });
        }
    });

    await payLaterSession.render('#paylater-button');
}
```

**Migration Notes:**
- V4: `FUNDING.CREDIT` → V6: `createPayLaterOneTimePaymentSession()`
- Eligibility check is mandatory in v6
- Terminology changed from "Credit" to "Pay Later"

---

### 3. FUNDING.VENMO

**IMPORTANT: Venmo was NOT SUPPORTED in checkout.js v4**

According to the official PayPal documentation, "Pay with Venmo" was **NOT supported** in checkout.js v4.

**V4 Code (Constant existed but feature didn't work):**
```javascript
// checkout.js v4 - FUNDING.VENMO constant existed but Venmo did NOT work
paypal.Button.render({
    funding: {
        allowed: [paypal.FUNDING.VENMO],  // Constant existed but Venmo didn't function
        disallowed: []
    },
    style: {
        label: 'pay',
        color: 'blue'
    },
    payment: function(data, actions) {
        return actions.payment.create({
            payment: {
                transactions: [{ amount: { total: '30.00', currency: 'USD' } }]
            }
        });
    },
    onAuthorize: function(data, actions) {
        return actions.payment.execute();
    }
}, '#venmo-button');
// This code would not produce a working Venmo button in v4
```

**V6 Equivalent:**
```javascript
// JS SDK v6 - Venmo with full support
const sdk = await window.paypal.createInstance({
    clientToken: clientToken.token,
    components: ['paypal-payments', 'venmo-payments'],  // Venmo requires separate component
    pageType: 'checkout'
});

const eligibleMethods = await sdk.findEligibleMethods();

if (eligibleMethods.venmo.isEligible) {
    const venmoSession = sdk.createVenmoOneTimePaymentSession({
        createOrder: async () => {
            const response = await fetch('/api/orders', { method: 'POST' });
            return (await response.json()).id;
        },
        onApprove: async (data) => {
            await fetch(`/api/orders/${data.orderID}/capture`, { method: 'POST' });
        }
    });

    await venmoSession.render('#venmo-button');
}
```

**Migration Notes:**
- **Venmo was NOT supported in checkout.js v4** (per official feature matrix)
- The `FUNDING.VENMO` constant existed in v4 code but the feature did not work
- **This is a NEW feature in v6, not a migration from v4**
- V6 has full native Venmo support
- Requires separate `venmo-payments` component in v6
- Eligibility check required
- Mobile-optimized experience in v6

---

### 4. FUNDING.CARD

**V4 Implementation:**
```javascript
// checkout.js v4 - Enable card payments (limited support)
paypal.Button.render({
    funding: {
        allowed: [paypal.FUNDING.CARD],
        disallowed: []
    },
    payment: function(data, actions) {
        return actions.payment.create({
            payment: {
                transactions: [{ amount: { total: '75.00', currency: 'USD' } }]
            }
        });
    },
    onAuthorize: function(data, actions) {
        return actions.payment.execute();
    }
}, '#card-button');
```

**V6 Equivalent:**
```javascript
// JS SDK v6 - Card payments
const sdk = await window.paypal.createInstance({
    clientToken: clientToken.token,
    components: ['card-payments'],  // Card requires separate component
    pageType: 'checkout'
});

const eligibleMethods = await sdk.findEligibleMethods();

if (eligibleMethods.card.isEligible) {
    const cardSession = sdk.createCardOneTimePaymentSession({
        createOrder: async () => {
            const response = await fetch('/api/orders', { method: 'POST' });
            return (await response.json()).id;
        },
        onApprove: async (data) => {
            await fetch(`/api/orders/${data.orderID}/capture`, { method: 'POST' });
        }
    });

    await cardSession.render('#card-button');
}
```

**Migration Notes:**
- Card payments have full support in v6
- Requires separate `card-payments` component
- Eligibility check required

---

### 5. Multiple Funding Sources

**V4 Implementation:**
```javascript
// checkout.js v4 - Multiple payment methods
paypal.Button.render({
    style: {
        layout: 'vertical',  // Stack buttons vertically
        size: 'responsive'
    },
    funding: {
        allowed: [
            paypal.FUNDING.CREDIT,
            paypal.FUNDING.VENMO
        ],
        disallowed: []
    },
    payment: function(data, actions) {
        return actions.payment.create({
            payment: {
                transactions: [{ amount: { total: '100.00', currency: 'USD' } }]
            }
        });
    },
    onAuthorize: function(data, actions) {
        return actions.payment.execute();
    }
}, '#multiple-buttons');
```

**V6 Equivalent:**
```javascript
// JS SDK v6 - Multiple payment methods
const sdk = await window.paypal.createInstance({
    clientToken: clientToken.token,
    components: ['paypal-payments', 'venmo-payments'],
    pageType: 'checkout'
});

const eligibleMethods = await sdk.findEligibleMethods();

// Render PayPal button (always available)
const paypalSession = sdk.createPayPalOneTimePaymentSession({
    createOrder: async () => {
        const response = await fetch('/api/orders', { method: 'POST' });
        return (await response.json()).id;
    },
    onApprove: async (data) => {
        await fetch(`/api/orders/${data.orderID}/capture`, { method: 'POST' });
    }
});
await paypalSession.render('#paypal-button');

// Render Pay Later if eligible
if (eligibleMethods.payLater.isEligible) {
    const payLaterSession = sdk.createPayLaterOneTimePaymentSession({
        createOrder: async () => {
            const response = await fetch('/api/orders', { method: 'POST' });
            return (await response.json()).id;
        },
        onApprove: async (data) => {
            await fetch(`/api/orders/${data.orderID}/capture`, { method: 'POST' });
        }
    });
    await payLaterSession.render('#paylater-button');
}

// Render Venmo if eligible
if (eligibleMethods.venmo.isEligible) {
    const venmoSession = sdk.createVenmoOneTimePaymentSession({
        createOrder: async () => {
            const response = await fetch('/api/orders', { method: 'POST' });
            return (await response.json()).id;
        },
        onApprove: async (data) => {
            await fetch(`/api/orders/${data.orderID}/capture`, { method: 'POST' });
        }
    });
    await venmoSession.render('#venmo-button');
}
```

**Migration Notes:**
- V4: Single render with `funding.allowed` array
- V6: Separate renders for each payment method
- V6: Each method checks its own eligibility
- V6: More granular control over button placement

---

## API Terminology Changes

### Payment Creation

**V4 Client-Side:**
```javascript
// checkout.js v4 - Client-side payment creation
payment: function(data, actions) {
    return actions.payment.create({
        payment: {
            transactions: [{
                amount: { total: '10.00', currency: 'USD' }
            }]
        }
    });
}
// Creates payment using v1 Payments API
// POST /v1/payments/payment
// Returns: PAY-XXXXX format payment ID
```

**V4 Server-Side Alternative:**
```javascript
// checkout.js v4 - Server-side payment creation
payment: function(data, actions) {
    return fetch('/api/create-payment', { method: 'POST' })
        .then(response => response.json())
        .then(data => data.paymentID);
}
// Server creates payment and returns ID
```

**V6 Server-Side (Required):**
```javascript
// JS SDK v6 - Server-side only
createOrder: async () => {
    const response = await fetch('/api/orders', { 
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            intent: 'CAPTURE',
            purchase_units: [{
                amount: { currency_code: 'USD', value: '10.00' }
            }]
        })
    });
    const order = await response.json();
    return order.id;
}
// Server creates order using v2 Orders API
// POST /v2/checkout/orders
// Returns: Alphanumeric order ID
```

**Migration Notes:**
- V4 `actions.payment.create()` → V6 server endpoint `/v2/checkout/orders`
- V4 payment ID format: `PAY-XXXXX` → V6 order ID format: Alphanumeric
- V6 eliminates client-side payment creation for security

---

### Payment Execution

**V4 Client-Side:**
```javascript
// checkout.js v4 - Client-side execution
onAuthorize: function(data, actions) {
    return actions.payment.execute().then(function(payment) {
        console.log('Payment completed:', payment);
        // payment.id = "PAY-XXXXX"
    });
}
// Executes payment using v1 Payments API
// POST /v1/payments/payment/{payment-id}/execute
```

**V4 Server-Side Alternative:**
```javascript
// checkout.js v4 - Server-side execution
onAuthorize: function(data, actions) {
    return fetch('/api/execute-payment', {
        method: 'POST',
        body: JSON.stringify({
            paymentID: data.paymentID,
            payerID: data.payerID
        })
    });
}
```

**V6 Server-Side (Required):**
```javascript
// JS SDK v6 - Server-side only
onApprove: async (data) => {
    const response = await fetch(`/api/orders/${data.orderID}/capture`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
    });
    const captureData = await response.json();
    console.log('Order captured:', captureData);
    // captureData.id = alphanumeric order ID
}
// Captures order using v2 Orders API
// POST /v2/checkout/orders/{order-id}/capture
```

**Migration Notes:**
- V4 `actions.payment.execute()` → V6 server endpoint `/v2/checkout/orders/{id}/capture`
- V4 uses `paymentID` and `payerID` → V6 uses `orderID` only
- V6 callback name changed: `onAuthorize` → `onApprove`

---

## Feature Terminology Changes

### 1. PayPal Credit → Pay Later

| Aspect | V4 (Credit) | V6 (Pay Later) |
|--------|-------------|----------------|
| **Name** | PayPal Credit | PayPal Pay Later |
| **Button Label** | `style: { label: 'credit' }` | `createPayLaterOneTimePaymentSession()` |
| **Funding Source** | `FUNDING.CREDIT` | Eligibility-based |
| **Color** | `darkblue` (typical) | Auto-determined |
| **Eligibility** | Implicit | Explicit check required |
| **Product Options** | Limited | Multiple (Pay in 4, Pay Monthly, etc.) |

### 2. Vault/Saved Payments

| Aspect | V4 | V6 |
|--------|----|----|
| **Vault Support** | Not supported in checkout.js v4 | Full support |
| **Setup Token** | N/A | `createPayPalSetupSession()` |
| **Payment Token** | N/A | `createPayPalPaymentSession()` |
| **Use Case** | Billing Agreements (separate API) | Native vault integration |

### 3. Subscriptions

| Aspect | V4 | V6 |
|--------|----|----|
| **Support** | Not supported | Fully supported |
| **API** | Separate subscriptions API | Integrated with JS SDK |

---

## Complete Migration Checklist

### Button Label Migrations

- [ ] Replace `label: 'paypal'` → `createPayPalOneTimePaymentSession()`
- [ ] Replace `label: 'checkout'` → `createPayPalOneTimePaymentSession()`
- [ ] Replace `label: 'buynow'` → `createPayPalOneTimePaymentSession()`
- [ ] Replace `label: 'pay'` → `createPayPalOneTimePaymentSession()`
- [ ] Replace `label: 'credit'` → `createPayLaterOneTimePaymentSession()` + eligibility

### Funding Source Migrations

- [ ] Remove `funding: { allowed: [FUNDING.PAYPAL] }` (implicit in v6)
- [ ] Replace `FUNDING.CREDIT` → `createPayLaterOneTimePaymentSession()` + eligibility
- [ ] Replace `FUNDING.VENMO` → `createVenmoOneTimePaymentSession()` + eligibility + component
- [ ] Replace `FUNDING.CARD` → `createCardOneTimePaymentSession()` + eligibility + component

### API Migrations

- [ ] Replace `actions.payment.create()` → Server endpoint `/v2/checkout/orders`
- [ ] Replace `actions.payment.execute()` → Server endpoint `/v2/checkout/orders/{id}/capture`
- [ ] Update payment ID handling: `PAY-XXXXX` → alphanumeric order ID
- [ ] Rename `onAuthorize` → `onApprove`

### Architecture Changes

- [ ] Implement client token generation (server-side)
- [ ] Add eligibility checks with `findEligibleMethods()`
- [ ] Move all API calls to server-side
- [ ] Add separate components for Venmo, Card, etc.
- [ ] Update error handling for v6 patterns

### Style/Customization

- [ ] Remove button label customizations (not supported in v6)
- [ ] Remove extensive color/shape customizations
- [ ] Accept PayPal-controlled button appearance
- [ ] Update layout strategy (separate containers per payment method)

---

## Quick Reference Table

| V4 Concept | V4 Syntax | V6 Equivalent | V6 Component |
|------------|-----------|---------------|--------------|
| PayPal button | `label: 'paypal'` | `createPayPalOneTimePaymentSession()` | `paypal-payments` |
| Checkout button | `label: 'checkout'` | `createPayPalOneTimePaymentSession()` | `paypal-payments` |
| Buy Now button | `label: 'buynow'` | `createPayPalOneTimePaymentSession()` | `paypal-payments` |
| Pay button | `label: 'pay'` | `createPayPalOneTimePaymentSession()` | `paypal-payments` |
| Credit button | `label: 'credit'` | `createPayLaterOneTimePaymentSession()` | `paypal-payments` |
| PayPal funding | `FUNDING.PAYPAL` | Default (always available) | `paypal-payments` |
| Credit funding | `FUNDING.CREDIT` | `createPayLaterOneTimePaymentSession()` | `paypal-payments` |
| Venmo funding | `FUNDING.VENMO` | `createVenmoOneTimePaymentSession()` | `venmo-payments` |
| Card funding | `FUNDING.CARD` | `createCardOneTimePaymentSession()` | `card-payments` |
| Payment create | `actions.payment.create()` | `POST /v2/checkout/orders` | Server-side |
| Payment execute | `actions.payment.execute()` | `POST /v2/checkout/orders/{id}/capture` | Server-side |
| Callback | `onAuthorize` | `onApprove` | N/A |

**Note**: Venmo was NOT supported in checkout.js v4 (constant existed but feature didn't work). This is a NEW feature in v6.

---

## Summary

**Key Takeaways:**

1. **All v4 button labels** (`paypal`, `checkout`, `buynow`, `pay`) → Same v6 session: `createPayPalOneTimePaymentSession()`
2. **V4 `label: 'credit'`** → V6 `createPayLaterOneTimePaymentSession()` with eligibility check
3. **V4 funding sources** → V6 separate session types with required components
4. **Terminology change:** "Credit" → "Pay Later"
5. **Architecture change:** Client-side operations → Server-mediated flow
6. **No label customization in v6** - PayPal controls button appearance

**Official Documentation:**
- [PayPal v6 SDK Documentation](https://docs.paypal.ai/payments/methods/paypal/sdk/js/v6/paypal-checkout)
- [PayPal v4 to v6 Migration Guide](https://developer.paypal.com/docs/checkout/standard/upgrade-integration/)

