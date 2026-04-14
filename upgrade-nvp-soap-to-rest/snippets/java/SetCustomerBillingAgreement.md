#### SNIPPET-SetCustomerBA

**Create a setup token for billing agreement (Flow B Migration)**

>  **Legacy Context:** This replaces the deprecated `SetCustomerBillingAgreement` API (deprecated since version 54.0). The legacy API returned tokens with "RP-" prefix. The modern API returns setup token IDs.

```java
public static class SetupTokenResponse {
    public String id;
    public String status;
    public List<Link> links;
    
    public static class Link {
        public String href;
        public String rel;
    }
}

public static SetupTokenResponse createSetupTokenForBillingAgreement() throws IOException, InterruptedException {
    try {
        String accessToken = getAccessToken();
        String createSetupTokenUrl = BASE_URL + "/v3/vault/setup-tokens";
        
        // Build payload
        Map<String, Object> payload = new HashMap<>();
        Map<String, Object> paymentSource = new HashMap<>();
        Map<String, Object> paypal = new HashMap<>();
        Map<String, Object> experienceContext = new HashMap<>();
        
        experienceContext.put("return_url", "https://example.com/return"); // Legacy equivalents — NVP: RETURNURL; SOAP: ReturnURL
        experienceContext.put("cancel_url", "https://example.com/cancel"); // Legacy equivalents — NVP: CANCELURL; SOAP: CancelURL
        experienceContext.put("locale", "en-US"); // Legacy equivalents — NVP: LOCALECODE; SOAP: LocaleCode
        
        paypal.put("description", "Monthly subscription for premium service"); // Legacy equivalents — NVP: L_BILLINGAGREEMENTDESCRIPTIONn; SOAP: BillingAgreementDetails.BillingAgreementDescription
        paypal.put("experience_context", experienceContext);
        paypal.put("usage_pattern", "IMMEDIATE"); // Only available in REST APIs
        paypal.put("usage_type", "MERCHANT"); // Only available in REST APIs
        
        paymentSource.put("paypal", paypal);
        payload.put("payment_source", paymentSource);
        
        String jsonPayload = gson.toJson(payload);
        
        HttpRequest request = HttpRequest.newBuilder()
            .uri(URI.create(createSetupTokenUrl))
            .header("Authorization", "Bearer " + accessToken)
            .header("PayPal-Request-Id", UUID.randomUUID().toString())
            .header("Content-Type", "application/json")
            .POST(HttpRequest.BodyPublishers.ofString(jsonPayload))
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
        
        String approvalUrl = setupToken.links.stream()
            .filter(link -> "approve".equals(link.rel))
            .map(link -> link.href)
            .findFirst()
            .orElse(null);
        
        System.out.println("Setup Token Created: " + setupToken.id);
        System.out.println("Redirect customer to: " + approvalUrl);
        
        return setupToken;
    } catch (Exception e) {
        System.out.println("Error: " + e.getMessage());
        throw e;
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

- **Webhook Required:** Set up webhook for `VAULT.PAYMENT-TOKEN.CREATED` event to capture the payment token ID after customer approval.

