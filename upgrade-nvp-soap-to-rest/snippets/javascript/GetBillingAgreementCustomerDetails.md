#### SNIPPET-GetBACustomerDetails

**Retrieve setup token details (Flow B Migration)**

>  **Legacy Context:** This replaces the deprecated `GetBillingAgreementCustomerDetails` API. **Critical:** The legacy API returned extensive customer information. The modern API returns token status but NOT detailed customer info.

```js
async function getSetupTokenDetails(setupTokenId) {
    try {
        const accessToken = await getPayPalAccessToken();
        const getSetupTokenUrl = `${baseUrl}/v3/vault/setup-tokens/${setupTokenId}`;
        
        const res = await axios.get(getSetupTokenUrl, {
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${accessToken}`,
            },
        });
        
        const setupToken = res.data;
        console.log("Setup Token Status:", setupToken.status);
        console.log("Setup Token Details:", setupToken);
        
        return setupToken;
    } catch (err) { 
        console.log(`Error debug id: ${err?.response?.data?.debug_id}`);
        console.error("Error details:", err?.response?.data);
        throw err;
    }
}
```

** Critical Migration Warning: Customer Data NOT Available**

The legacy `GetBillingAgreementCustomerDetails` API returned:
-  Customer email, name, address (NVP: ALL fields unsupported)
-  Customer email, name, address (SOAP: SOME fields available in payment token response)
-  Payer ID, payer status
-  Shipping information

**The modern REST API response includes:**
-  Setup token status and ID
-  Payment source type
-  Links for approval and other actions
-  NO customer personal information in this call

**Migration Strategy:**

1. **For NVP Users:** You MUST store customer information in your own database before redirecting to PayPal. The REST API will not return this data.

2. **For SOAP Users:** Some customer data is available after creating the payment token:
```js
// After creating payment token, you can get limited customer info
async function getPaymentTokenDetails(paymentTokenId) {
    const accessToken = await getPayPalAccessToken();
    const url = `${baseUrl}/v3/vault/payment-tokens/${paymentTokenId}`;
    const res = await axios.get(url, {
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`,
        },
    });
    
    // Available fields:
    const customerData = {
        email: res.data.payment_source?.paypal?.email_address,
        accountId: res.data.payment_source?.paypal?.account_id,
        name: res.data.payment_source?.paypal?.name?.full_name,
        address: res.data.payment_source?.paypal?.address
    };
    
    return customerData;
}
```

3. **Alternative:** Use PayPal Identity APIs after customer authorization to get detailed customer information.

**Fields NOT Available in v3 (Plan Accordingly):**

**NVP Response - ALL UNSUPPORTED:**
- `EMAIL`, `FIRSTNAME`, `LASTNAME`, `PAYERID`, `PAYERSTATUS`
- `COUNTRYCODE`, `ADDRESSSTATUS`, `PAYERBUSINESS`
- `SHIPTONAME`, `SHIPTOSTREET`, `SHIPTOCITY`, `SHIPTOSTATE`, `SHIPTOZIP`

**SOAP Response - PARTIALLY SUPPORTED:**
- `PayerInfo.Payer` maps to `payment_source.paypal.email_address`
- `PayerInfo.PayerID` maps to `payment_source.paypal.account_id`
- `PayerInfo.Address.*` maps to `payment_source.paypal.address.*`
- `PayerInfo.PayerStatus`, `PayerInfo.PayerBusiness` - Not supported
- Separate first/last/middle names - Only full_name available

**Error Code Migration:**

| Legacy Code | Legacy Message | REST Equivalent |
|-------------|---------------|-----------------|
| 10408 | Token is missing | TOKEN_NOT_FOUND |
| 10409 | Not authorized | Generic 401/403 |
| 10410 | Invalid token | Generic 404/400 |
| 10411 | Session expired | Generic 404 |

