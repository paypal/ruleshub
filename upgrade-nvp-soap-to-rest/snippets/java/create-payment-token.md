#### Exchanging temporary setup token for a payment token

```java
public static class PaymentToken {
    public String id;
}

// `setupTokenId` is the setup token created with the `POST /v3/vault/setup-tokens` call.
public static PaymentToken createPaymentToken(String setupTokenId) throws IOException, InterruptedException {
    try {
        String accessToken = getAccessToken();
        String createPaymentTokenUrl = BASE_URL + "/v3/vault/payment-tokens";
        
        Map<String, Object> payload = new HashMap<>();
        Map<String, Object> paymentSource = new HashMap<>();
        Map<String, Object> token = new HashMap<>();
        
        token.put("id", setupTokenId);
        token.put("type", "SETUP_TOKEN");
        paymentSource.put("token", token);
        payload.put("payment_source", paymentSource);
        
        String jsonPayload = gson.toJson(payload);
        
        HttpRequest request = HttpRequest.newBuilder()
            .uri(URI.create(createPaymentTokenUrl))
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
        
        return gson.fromJson(response.body(), PaymentToken.class);
    } catch (Exception e) {
        System.out.println("Error: " + e.getMessage());
        throw e;
    }
}
```