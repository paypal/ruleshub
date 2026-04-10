#### SNIPPET-URPP

**Update Subscription (replaces UpdateRecurringPaymentsProfile)**

> REST equivalent: `PATCH /v1/billing/subscriptions/{subscription_id}`

```js
const crypto = require('crypto');
const axios = require('axios');

/**
 * Update subscription
 * Legacy equivalents — NVP: UpdateRecurringPaymentsProfile; SOAP: UpdateRecurringPaymentsProfile
 * 
 * @param {string} subscriptionId - REST subscription ID (starts with I-)
 *                                  Legacy equivalents — NVP: PROFILEID; SOAP: ProfileID
 * @param {Array} patchOperations - JSON Patch operations array
 * @returns {object} Updated subscription
 */
async function updateSubscription(subscriptionId, patchOperations) {
    try {
        const accessToken = await getPayPalAccessToken();
        
        const response = await axios.patch(
            `${baseUrl}/v1/billing/subscriptions/${subscriptionId}`,
            patchOperations,
            {
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'PayPal-Request-Id': crypto.randomUUID(),
                    'Content-Type': 'application/json',
                }
            }
        );
        
        return response.data;
    } catch (err) {
        console.log(`Error debug id: ${err?.response?.data?.debug_id}`);
        throw err;
    }
}
```

**Update billing amount (20% limit applies)**

```js
/**
 * Update subscription billing amount
 * Legacy equivalents — NVP: AMT; SOAP: PaymentPeriod.Amount
 * 
 * Note: Can only increase by 20% maximum per 180-day interval
 * Note: Cannot update within 3 days of scheduled billing date
 */
async function updateBillingAmount(subscriptionId, amount, currencyCode = 'USD') {
    const patchOperations = [{
        op: "replace",
        path: "/plan/billing_cycles/@sequence==1/pricing_scheme/fixed_price",
        value: {
            currency_code: currencyCode, // Legacy equivalents — NVP: CURRENCYCODE; SOAP: Amount.currencyID
            value: amount                // Legacy equivalents — NVP: AMT; SOAP: PaymentPeriod.Amount
        }
    }];
    
    return updateSubscription(subscriptionId, patchOperations);
}
```

**Update shipping amount**

```js
/**
 * Update subscription shipping amount
 * Legacy equivalents — NVP: SHIPPINGAMT; SOAP: PaymentPeriod.ShippingAmount
 */
async function updateShippingAmount(subscriptionId, amount, currencyCode = 'USD') {
    const patchOperations = [{
        op: "replace",
        path: "/shipping_amount",
        value: {
            currency_code: currencyCode,
            value: amount  // Legacy equivalents — NVP: SHIPPINGAMT; SOAP: PaymentPeriod.ShippingAmount
        }
    }];
    
    return updateSubscription(subscriptionId, patchOperations);
}
```
