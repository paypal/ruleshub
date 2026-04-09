#### Create a new setup token

```js
async function createSetupToken() {
    try {
        const accessToken = await getPayPalAccessToken();
        const createSetupTokenUrl = `${baseUrl}/v3/vault/setup-tokens`;
        const payload = {
            "payment_source": {
                "paypal": {
                    "experience_context": {
                        "shipping_preference": "SET_PROVIDED_ADDRESS", // Legacy equivalents — NVP: ADDROVERRIDE; SOAP: AddressOverride
                        "brand_name": "EXAMPLE INC", // Legacy equivalents — NVP: BRANDNAME; SOAP: BrandName
                        "locale": "en-US", // Legacy equivalents — NVP: LOCALECODE; SOAP: LocaleCode
                        "return_url": "https://example.com/returnUrl", // Legacy equivalents — NVP: RETURNURL; SOAP: ReturnURL
                        "cancel_url": "https://example.com/cancelUrl" // Legacy equivalents — NVP: CANCELURL; SOAP: CancelURL
                    },
                    "usage_pattern": "IMMEDIATE", // Only available in REST APIs
                    "usage_type": "MERCHANT", // Only available in REST APIs
                }
            }
        };
        const res = await axios.post(createSetupTokenUrl, payload, {
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${accessToken}`,
                "PayPal-Request-Id": crypto.randomUUID(),
            },
        });
        const setupTokenId = res.data.id;
        const approvalUrl = res.data.links?.find((l) => l.rel === "approve")?.href || null;
        return { setupTokenId, approvalUrl };
    } catch (err) { 
        console.log(`Error debug id: ${err?.response?.data?.debug_id}`);
        throw err;
    }
}
```