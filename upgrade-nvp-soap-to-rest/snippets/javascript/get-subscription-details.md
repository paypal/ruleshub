#### SNIPPET-GRPPD

**Get Subscription Details (replaces GetRecurringPaymentsProfileDetails)**

> REST equivalent: `GET /v1/billing/subscriptions/{subscription_id}`

```js
const crypto = require('crypto');
const axios = require('axios');

/**
 * Get subscription details
 * Legacy equivalents — NVP: GetRecurringPaymentsProfileDetails; SOAP: GetRecurringPaymentsProfileDetails
 * 
 * @param {string} subscriptionId - REST subscription ID (starts with I-)
 *                                  Legacy equivalents — NVP: PROFILEID; SOAP: ProfileID
 * @returns {object} Subscription details including status, billing_info, subscriber
 */
async function getSubscriptionDetails(subscriptionId) {
    try {
        const accessToken = await getPayPalAccessToken();
        
        const response = await axios.get(
            `${baseUrl}/v1/billing/subscriptions/${subscriptionId}`,
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

**Get Plan Details (optional - if full billing cycle config needed)**

> Call this if subscription response doesn't include full billing cycle configuration

```js
/**
 * Get plan details
 * 
 * @param {string} planId - Plan ID from subscription.plan_id
 */
async function getPlanDetails(planId) {
    try {
        const accessToken = await getPayPalAccessToken();
        
        const response = await axios.get(
            `${baseUrl}/v1/billing/plans/${planId}`,
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
