#### SNIPPET-GetBACustomerDetails

**Retrieve setup token details (Flow B Migration)**

>  **Legacy Context:** This replaces the deprecated `GetBillingAgreementCustomerDetails` API. **Critical:** The legacy API returned extensive customer information. The modern API returns token status but NOT detailed customer info.

```php
function getSetupTokenDetails($setupTokenId) 
{
    global $paypalHostname;
    $url = $paypalHostname . '/v3/vault/setup-tokens/' . $setupTokenId;
    $accessToken = getPayPalAccessToken();
    
    $headers = [
        'Content-Type: application/json',
        'Authorization: Bearer ' . $accessToken
    ];
    
    $ch = curl_init();
    curl_setopt($ch, CURLOPT_URL, $url);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_HTTPHEADER, $headers);
    
    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    
    if (curl_errno($ch)) {
        error_log('Curl error: ' . curl_error($ch));
    }
    curl_close($ch);
    
    $responseData = json_decode($response, true);
    
    if ($httpCode >= 300) {
        error_log('Error debug id: ' . ($responseData['debug_id'] ?? 'N/A'));
        throw new Exception("Error retrieving setup token: " . $response);
    }
    
    error_log("Setup Token Status: " . $responseData['status']);
    
    return $responseData;
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
```php
// After creating payment token, you can get limited customer info
function getPaymentTokenDetails($paymentTokenId) 
{
    global $paypalHostname;
    $url = $paypalHostname . '/v3/vault/payment-tokens/' . $paymentTokenId;
    $accessToken = getPayPalAccessToken();
    
    $headers = [
        'Content-Type: application/json',
        'Authorization: Bearer ' . $accessToken
    ];
    
    $ch = curl_init();
    curl_setopt($ch, CURLOPT_URL, $url);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_HTTPHEADER, $headers);
    
    $response = curl_exec($ch);
    curl_close($ch);
    
    $responseData = json_decode($response, true);
    
    // Available fields:
    $customerData = [
        'email' => $responseData['payment_source']['paypal']['email_address'] ?? null,
        'accountId' => $responseData['payment_source']['paypal']['account_id'] ?? null,
        'name' => $responseData['payment_source']['paypal']['name']['full_name'] ?? null,
        'address' => $responseData['payment_source']['paypal']['address'] ?? null
    ];
    
    return $customerData;
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

