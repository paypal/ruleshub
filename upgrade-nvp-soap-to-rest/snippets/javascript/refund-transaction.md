#### Refund the pending captured amount

> Send an empty request body to initiate a refund for the amount equal to [captured amount – refunds already issued].

```js
async function refundTransaction(transactionId) { 
    try { 
        const accessToken = await getPayPalAccessToken();
        const response = await axios.post(`${baseUrl}/v2/payments/captures/${transactionId}/refund`,{}, {
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${accessToken}`,
                'PayPal-Request-Id': crypto.randomUUID(),
            },
        });
        return response.data.id;
    } catch (err) { 
        console.log(`Error debug id: ${err?.response?.data?.debug_id}`);
        throw err;
    }
}
```

#### Refund specific amount

> Include the specific amount in the request body to initiate a refund for that amount against the capture.

```js
async function refundTransactionPartial(transactionId, amount) { 
    try { 
        const accessToken = await getPayPalAccessToken();
        const response = await axios.post(`${baseUrl}/v2/payments/captures/${transactionId}/refund`,{
            amount: {
                currency_code: 'USD', // Legacy equivalents — NVP: CURRENCYCODE ; SOAP: Amount.currencyID
                value: amount // Legacy equivalents — NVP: AMT ; SOAP: Amount
            }
        }, {
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${accessToken}`,
                'PayPal-Request-Id': crypto.randomUUID()
            }
        });
        return response.data.id;
    } catch (err) { 
        console.log(`Error debug id: ${err?.response?.data?.debug_id}`);
        throw err;
    }
}
```