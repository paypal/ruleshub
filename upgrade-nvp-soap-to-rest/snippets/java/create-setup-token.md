#### Create a new setup token

```java
public static class CreateSetupTokenResult {
    public String setupTokenId;
    public String approvalUrl;
    
    public CreateSetupTokenResult(String setupTokenId, String approvalUrl) {
        this.setupTokenId = setupTokenId;
        this.approvalUrl = approvalUrl;
    }
}

// Vaulting/Billing Agreements
public static CreateSetupTokenResult createSetupToken() throws IOException, InterruptedException {
    try {
        String accessToken = getAccessToken();
        String createSetupTokenUrl = BASE_URL + "/v3/vault/setup-tokens";
        Map<String, Object> payload = new HashMap<>();
        Map<String, Object> paymentSource = new HashMap<>();
        Map<String, Object> paypal = new HashMap<>();
        Map<String, Object> experienceContext = new HashMap<>();
        experienceContext.put("return_url", "https://example.com/return"); // Legacy equivalents — NVP: RETURNURL; SOAP: ReturnURL
        experienceContext.put("cancel_url", "https://example.com/cancel"); // Legacy equivalents — NVP: CANCELURL; SOAP: CancelURL
        experienceContext.put("shipping_preference", "SET_PROVIDED_ADDRESS"); // Legacy equivalents — NVP: ADDROVERRIDE; SOAP: AddressOverride
        experienceContext.put("brand_name", "Example Store"); // Legacy equivalents — NVP: BRANDNAME; SOAP: BrandName
        experienceContext.put("locale", "en-US"); // Legacy equivalents — NVP: LOCALECODE; SOAP: LocaleCode
        paypal.put("usage_pattern", "IMMEDIATE"); // Only available in REST APIs
        paypal.put("usage_type", "MERCHANT"); // Only available in REST APIs
        paypal.put("experience_context", experienceContext);
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
            throw new IOException("Request failed with status code " + response.statusCode());
        }
        
        JsonObject jsonResponse = JsonParser.parseString(response.body()).getAsJsonObject();
        String setupTokenId = jsonResponse.get("id").getAsString();
        String approvalUrl = null;
        
        if (jsonResponse.has("links")) {
            JsonArray links = jsonResponse.getAsJsonArray("links");
            for (JsonElement link : links) {
                JsonObject linkObj = link.getAsJsonObject();
                String rel = linkObj.get("rel").getAsString();
                if (rel.equals("approve")) {
                    approvalUrl = linkObj.get("href").getAsString();
                    break;
                }
            }
        }
        
        return new CreateSetupTokenResult(setupTokenId, approvalUrl);
    } catch (Exception e) {
        System.out.println("Error: " + e.getMessage());
        throw e;
    }
}
```