#### Exchanging temporary setup token for a payment token

```js
// `setupTokenId` is the setup token created with the `POST /v3/vault/setup-tokens` call.
async function createPaymentToken(setupTokenId) {
    try {
        const accessToken = await getPayPalAccessToken();
        const createPaymentTokenUrl = `${baseUrl}/v3/vault/payment-tokens`;
        const payload = {
            "payment_source": {
                "token": {
                    "id": setupTokenId,
                    "type": "SETUP_TOKEN"
                }
            }
        };
        const res = await axios.post(createPaymentTokenUrl, payload, {
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${accessToken}`,
                "PayPal-Request-Id": crypto.randomUUID(),
            },
        });
        const paymentToken = res.data;
        return paymentToken;
    } catch (err) { 
        console.log(`Error debug id: ${err?.response?.data?.debug_id}`);
        throw err;
    }
}
```