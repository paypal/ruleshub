#### Creating a "CAPTURE" order with vaulted payment

```js
async function captureReferenceTransaction(vaultId, amount, currencyCode) {
    try {
        const accessToken = await getPayPalAccessToken();
        const createOrderUrl = `${baseUrl}/v2/checkout/orders`;
        const orderPayload = {
            intent: 'CAPTURE', // Legacy equivalents — NVP: PAYMENTACTION ; SOAP: PaymentAction
            purchase_units: [  
                {
                    amount: {
                        currency_code: currencyCode, // Legacy equivalents — NVP: CURRENCYCODE ; SOAP: PaymentDetails.OrderTotal.currencyID
                        value: amount, // Legacy equivalents — NVP: AMT ; SOAP: PaymentDetails.OrderTotal
                    },
                },
            ],
            payment_source: {
                paypal: {
                    vault_id: vaultId, // Used in place of legacy payload's BILLINGAGREEMENTID.
                },
            },
        };
        const createOrderResponse = await axios.post(createOrderUrl, orderPayload, {
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${accessToken}`,
                'PayPal-Request-Id': crypto.randomUUID(),
            },
        });
        const orderId = createOrderResponse.data.id;
        return createOrderResponse.data;
    } catch (err) {
        console.log(`Error debug id: ${err?.response?.data?.debug_id}`);
        throw err;
    }
}
```

#### Creating a "AUTHORIZE" order with vaulted payment

```js
async function authorizeAndCaptureReferenceTransaction(vaultId, amount, currencyCode) {
    try {
        const accessToken = await getPayPalAccessToken();
        const createOrderUrl = `${baseUrl}/v2/checkout/orders`;
        const orderPayload = {
            intent: 'AUTHORIZE', // Legacy equivalents — NVP: PAYMENTACTION ; SOAP: PaymentAction 
            purchase_units: [
                {
                    amount: {
                        currency_code: currencyCode, // Legacy equivalents — NVP: CURRENCYCODE ; SOAP: PaymentDetails.OrderTotal.currencyID
                        value: amount, // Legacy equivalents — NVP: AMT ; SOAP: PaymentDetails.OrderTotal
                    },
                },
            ],
            payment_source: {
                paypal: {
                    vault_id: vaultId, // Used in place of legacy payload's BILLINGAGREEMENTID.
                },
            },
        };
        const createOrderResponse = await axios.post(createOrderUrl, orderPayload, {
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${accessToken}`,
                'PayPal-Request-Id': crypto.randomUUID(),
            },
        });
        const authorizationId = createOrderResponse.data.purchase_units[0].payments.authorizations[0].id;
        const captureDetails = await captureAuthorization(authorizationId);
        return captureDetails;
    } catch (err) {
        console.log(`Error debug id: ${err?.response?.data?.debug_id}`);
        throw err;
    }
}
```