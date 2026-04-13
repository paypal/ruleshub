#### SNIPPET-MRPPS

**Manage Subscription Status (replaces ManageRecurringPaymentsProfileStatus)**

> REST has three separate endpoints based on action:
> - Suspend: `POST /v1/billing/subscriptions/{id}/suspend`
> - Cancel: `POST /v1/billing/subscriptions/{id}/cancel`
> - Reactivate: `POST /v1/billing/subscriptions/{id}/activate`

**Suspend Subscription**

```js
const crypto = require('crypto');
const axios = require('axios');

/**
 * Suspend subscription (temporarily pause billing)
 * Legacy equivalents — NVP: ManageRecurringPaymentsProfileStatus with ACTION=Suspend
 * 
 * @param {string} subscriptionId - REST subscription ID (starts with I-)
 *                                  Legacy equivalents — NVP: PROFILEID; SOAP: ProfileID
 * @param {string} reason - Reason for suspension (required in REST)
 *                          Legacy equivalents — NVP: NOTE; SOAP: Note
 */
async function suspendSubscription(subscriptionId, reason) {
    try {
        const accessToken = await getPayPalAccessToken();
        
        await axios.post(
            `${baseUrl}/v1/billing/subscriptions/${subscriptionId}/suspend`,
            { reason },  // Required in REST, optional in NVP
            {
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'PayPal-Request-Id': crypto.randomUUID(),
                    'Content-Type': 'application/json',
                }
            }
        );
        
        console.log('Subscription suspended');
    } catch (err) {
        console.log(`Error debug id: ${err?.response?.data?.debug_id}`);
        throw err;
    }
}
```

**Cancel Subscription**

```js
/**
 * Cancel subscription (permanently end - cannot be undone)
 * Legacy equivalents — NVP: ManageRecurringPaymentsProfileStatus with ACTION=Cancel
 * 
 * @param {string} subscriptionId - REST subscription ID
 *                                  Legacy equivalents — NVP: PROFILEID; SOAP: ProfileID
 * @param {string} reason - Reason for cancellation (required in REST)
 *                          Legacy equivalents — NVP: NOTE; SOAP: Note
 */
async function cancelSubscription(subscriptionId, reason) {
    try {
        const accessToken = await getPayPalAccessToken();
        
        await axios.post(
            `${baseUrl}/v1/billing/subscriptions/${subscriptionId}/cancel`,
            { reason },  // Required in REST, optional in NVP
            {
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'PayPal-Request-Id': crypto.randomUUID(),
                    'Content-Type': 'application/json',
                }
            }
        );
        
        console.log('Subscription cancelled');
    } catch (err) {
        console.log(`Error debug id: ${err?.response?.data?.debug_id}`);
        throw err;
    }
}
```

**Reactivate Subscription**

```js
/**
 * Reactivate subscription (resume from suspended state)
 * Legacy equivalents — NVP: ManageRecurringPaymentsProfileStatus with ACTION=Reactivate
 * 
 * Note: This is the same endpoint used for initial activation after buyer approval
 * 
 * @param {string} subscriptionId - REST subscription ID
 *                                  Legacy equivalents — NVP: PROFILEID; SOAP: ProfileID
 * @param {string} reason - Reason for reactivation
 *                          Legacy equivalents — NVP: NOTE; SOAP: Note
 */
async function reactivateSubscription(subscriptionId, reason) {
    try {
        const accessToken = await getPayPalAccessToken();
        
        await axios.post(
            `${baseUrl}/v1/billing/subscriptions/${subscriptionId}/activate`,
            { reason },
            {
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'PayPal-Request-Id': crypto.randomUUID(),
                    'Content-Type': 'application/json',
                }
            }
        );
        
        console.log('Subscription reactivated');
    } catch (err) {
        console.log(`Error debug id: ${err?.response?.data?.debug_id}`);
        throw err;
    }
}
```
