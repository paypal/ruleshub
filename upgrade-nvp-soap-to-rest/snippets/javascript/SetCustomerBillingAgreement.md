#### SNIPPET-SetCustomerBA

**Create a setup token for billing agreement (Flow B Migration)**

>  **Legacy Context:** This replaces the deprecated `SetCustomerBillingAgreement` API (deprecated since version 54.0). The legacy API returned tokens with "RP-" prefix. The modern API returns setup token IDs.

```js
async function createSetupTokenForBillingAgreement() {
    try {
        const accessToken = await getPayPalAccessToken();
        const createSetupTokenUrl = `${baseUrl}/v3/vault/setup-tokens`;
        const payload = {
            "payment_source": {
                "paypal": {
                    "description": "Monthly subscription for premium service", // Legacy equivalents — NVP: L_BILLINGAGREEMENTDESCRIPTIONn; SOAP: BillingAgreementDetails.BillingAgreementDescription
                    "experience_context": {
                        "return_url": "https://example.com/return", // Legacy equivalents — NVP: RETURNURL; SOAP: ReturnURL
                        "cancel_url": "https://example.com/cancel", // Legacy equivalents — NVP: CANCELURL; SOAP: CancelURL
                        "locale": "en-US" // Legacy equivalents — NVP: LOCALECODE; SOAP: LocaleCode
                    },
                    "usage_pattern": "IMMEDIATE", // Only available in REST APIs
                    "usage_type": "MERCHANT" // Only available in REST APIs
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
        
        console.log("Setup Token Created:", setupTokenId);
        console.log("Redirect customer to:", approvalUrl);
        
        return { setupTokenId, approvalUrl };
    } catch (err) { 
        console.log(`Error debug id: ${err?.response?.data?.debug_id}`);
        console.error("Error details:", err?.response?.data);
        throw err;
    }
}
```

**Migration Notes:**

- **Legacy Fields NOT Supported:**
  - `BILLINGTYPE` / `BillingAgreementDetails.BillingType` - Handled by vault endpoint structure
  - `PAGESTYLE`, `HDRIMG`, `HDRBACKCOLOR`, etc. - UI customization not available in v3
  - `L_BILLINGAGREEMENTCUSTOMn` - Custom metadata not supported
  - `EMAIL` / `BuyerEmail` - Not required in vault setup

- **Authentication:** Replace `USER`, `PWD`, `SIGNATURE` with OAuth 2.0 access token

- **Token Format:** Legacy returned "RP-{token}" format. REST returns a setup token ID.

- **Webhook Required:** Set up webhook for `VAULT.PAYMENT-TOKEN.CREATED` event to capture the payment token ID after customer approval. See [Webhook Creation](#snippet-setec-002).

