#### SNIPPET-GetBACustomerDetails

**Retrieve setup token details (Flow B Migration)**

> This replaces the deprecated `GetBillingAgreementCustomerDetails` API. Important: The legacy API returned extensive customer information, but the modern API only returns token status without detailed customer info.

```java
public static SetupTokenResponse getSetupTokenDetails(String setupTokenId) throws IOException, InterruptedException {
    try {
        String accessToken = getAccessToken();
        String getSetupTokenUrl = BASE_URL + "/v3/vault/setup-tokens/" + setupTokenId;
        
        HttpRequest request = HttpRequest.newBuilder()
            .uri(URI.create(getSetupTokenUrl))
            .header("Authorization", "Bearer " + accessToken)
            .header("Content-Type", "application/json")
            .GET()
            .build();
        
        HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
        
        if (response.statusCode() >= 400) {
            JsonObject errorResponse = JsonParser.parseString(response.body()).getAsJsonObject();
            String debugId = errorResponse.has("debug_id") ? errorResponse.get("debug_id").getAsString() : "N/A";
            System.out.println("Error debug id: " + debugId);
            System.err.println("- Status: " + response.statusCode());
            System.err.println("- Data: " + response.body());
            throw new IOException("Request failed with status code " + response.statusCode());
        }
        
        SetupTokenResponse setupToken = gson.fromJson(response.body(), SetupTokenResponse.class);
        System.out.println("Setup Token Status: " + setupToken.status);
        
        return setupToken;
    } catch (Exception e) {
        System.out.println("Error: " + e.getMessage());
        throw e;
    }
}
```

**Important: Customer Data Limitations**

The legacy `GetBillingAgreementCustomerDetails` API returned:
- Customer email, name, address (NVP: all fields unsupported)
- Customer email, name, address (SOAP: some fields available in payment token response)
- Payer ID, payer status
- Shipping information

**The modern REST API response includes:**
- Setup token status and ID
- Payment source type
- Links for approval and other actions
- No customer personal information in this call

**Migration Strategy:**

1. **For NVP Users:** You'll need to store customer information in your own database before redirecting to PayPal, since the REST API won't return this data.

2. **For SOAP Users:** Some customer data is available after creating the payment token:
```java
public static class CustomerData {
    public String email;
    public String accountId;
    public String name;
    public Map<String, String> address;
}

public static CustomerData getPaymentTokenDetails(String paymentTokenId) throws IOException, InterruptedException {
    String accessToken = getAccessToken();
    String url = BASE_URL + "/v3/vault/payment-tokens/" + paymentTokenId;
    
    HttpRequest request = HttpRequest.newBuilder()
        .uri(URI.create(url))
        .header("Authorization", "Bearer " + accessToken)
        .header("Content-Type", "application/json")
        .GET()
        .build();
    
    HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
    JsonObject data = JsonParser.parseString(response.body()).getAsJsonObject();
    
    // Extract available customer fields
    JsonObject paypal = data.getAsJsonObject("payment_source").getAsJsonObject("paypal");
    
    CustomerData customerData = new CustomerData();
    customerData.email = paypal.has("email_address") ? paypal.get("email_address").getAsString() : null;
    customerData.accountId = paypal.has("account_id") ? paypal.get("account_id").getAsString() : null;
    
    if (paypal.has("name")) {
        JsonObject name = paypal.getAsJsonObject("name");
        customerData.name = name.has("full_name") ? name.get("full_name").getAsString() : null;
    }
    
    if (paypal.has("address")) {
        customerData.address = gson.fromJson(paypal.get("address"), Map.class);
    }
    
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

