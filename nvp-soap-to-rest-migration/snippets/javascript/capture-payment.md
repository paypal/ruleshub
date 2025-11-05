#### Capturing full authorized amount

> Use the capture authorization endpoint with an empty request body to capture the entire authorized amount and treat it as the final capture.

```js
async function captureAuthorization(authorizationId) {
    try {
        const accessToken = await getPayPalAccessToken();
        const response = await axios.post(`${baseUrl}/v2/payments/authorizations/${authorizationId}/capture`, {}, {
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'PayPal-Request-Id': crypto.randomUUID(),
                'Content-Type': 'application/json',
            }
        });
        return response.data.id; // Returns the ID assigned for the captured payment.
    } catch (err) {
        console.log(`Error debug id: ${err?.response?.data?.debug_id}`);
        throw err;
    }
}
```

#### Capturing part of the authorized amount

> For partial captures, specify amount to be captured and set "final_capture" explicitly to false.

```js
async function captureAuthorizationPartial(authorizationId, amount, finalCapture = true) { 
    try { 
        const accessToken = await getPayPalAccessToken();
        const response = await axios.post(`${baseUrl}/v2/payments/authorizations/${authorizationId}/capture`, {
            amount: {
                currency_code: 'USD', // Legacy equivalents — NVP: CURRENCYCODE; SOAP: Amount.currencyID
                value: amount, // Legacy equivalents — NVP: AMT; SOAP: Amount
            },
            final_capture: finalCapture, // Legacy equivalents — NVP: COMPLETETYPE; SOAP: CompleteType
        }, {
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'PayPal-Request-Id': crypto.randomUUID(),
                'Content-Type': 'application/json',
            }
        });
        return response.data.id; // Returns the ID assigned for the captured payment.
    } catch (err) { 
        console.log(`Error debug id: ${err?.response?.data?.debug_id}`);
        throw err;
    }
}
```