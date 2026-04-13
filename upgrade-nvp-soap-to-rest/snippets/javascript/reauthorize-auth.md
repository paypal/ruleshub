#### Reauthorizing the full amount that was authorized before

> Note: Sending a reauthorization request with an empty body will reauthorize the full amount of the previously authorized order.

```js
// The authorizationId parameter must be the original identifier returned when the order was first authorized.
async function reauthorizeAuth(authorizationId) {
    try {
        const accessToken = await getPayPalAccessToken();
        const response = await axios.post(`${baseUrl}/v2/payments/authorizations/${authorizationId}/reauthorize`, {}, {
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${accessToken}`,
                'PayPal-Request-Id': crypto.randomUUID(),
            },
        });
        return response.data.id; // ID for the reauthorized authorization.
    } catch (err) {
        console.log(`Error debug id: ${err?.response?.data?.debug_id}`);
        throw err;
    }
}
```

#### Reauthorizing part of the amount that was authorized before

> Note: Include the amount field in the reauthorization request body to reauthorize a specific amount, which must not exceed the originally authorized value.

```js
async function reauthorizeAuthPartial(authorizationId, amount) { 
    try { 
        const accessToken = await getPayPalAccessToken();
        const response = await axios.post(`${baseUrl}/v2/payments/authorizations/${authorizationId}/reauthorize`, {
            amount: {
                currency_code: "USD", // Legacy equivalents — NVP: CURRENCYCODE; SOAP: Not Supported
                value: amount, // Legacy equivalents — NVP: AMT; SOAP: Amount
            },
        }, {
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${accessToken}`,
                'PayPal-Request-Id': crypto.randomUUID(),
            },
        });
        return response.data.id; // ID for the reauthorized authorization.
    } catch (err) { 
        console.log(`Error debug id: ${err?.response?.data?.debug_id}`);
        throw err;
    }
}
```