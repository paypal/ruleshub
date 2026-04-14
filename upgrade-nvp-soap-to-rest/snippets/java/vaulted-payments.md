#### Creating a "CAPTURE" order with vaulted payment

```java
public static JsonObject captureReferenceTransaction(String vaultId, String amount, String currencyCode) throws IOException, InterruptedException {
    try {
        String accessToken = getAccessToken();
        String createOrderUrl = BASE_URL + "/v2/checkout/orders";
        
        Map<String, Object> payload = new HashMap<>();
        Map<String, Object> amountMap = new HashMap<>();
        Map<String, Object> purchaseUnit = new HashMap<>();
        Map<String, Object> paymentSource = new HashMap<>();
        Map<String, Object> paypal = new HashMap<>();
        
        amountMap.put("currency_code", currencyCode); // Legacy equivalents — NVP: CURRENCYCODE ; SOAP: PaymentDetails.OrderTotal.currencyID
        amountMap.put("value", amount); // Legacy equivalents — NVP: AMT ; SOAP: PaymentDetails.OrderTotal
        
        purchaseUnit.put("amount", amountMap);
        
        paypal.put("vault_id", vaultId); // Used in place of legacy payload's BILLINGAGREEMENTID
        paymentSource.put("paypal", paypal);
        
        payload.put("intent", "CAPTURE"); // Legacy equivalents — NVP: PAYMENTACTION ; SOAP: PaymentAction
        payload.put("purchase_units", new Object[]{purchaseUnit});
        payload.put("payment_source", paymentSource);
        
        String jsonPayload = gson.toJson(payload);
        
        HttpRequest request = HttpRequest.newBuilder()
            .uri(URI.create(createOrderUrl))
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
        String orderId = jsonResponse.get("id").getAsString();
        System.out.println("Order created with ID: " + orderId);
        System.out.println("Order details: " + response.body());
        
        return jsonResponse;
    } catch (Exception e) {
        System.out.println("Error: " + e.getMessage());
        throw e;
    }
}
```

#### Creating a "AUTHORIZE" order with vaulted payment

```java
public static JsonObject authorizeAndCaptureReferenceTransaction(String vaultId, String amount, String currencyCode) throws IOException, InterruptedException {
    try {
        String accessToken = getAccessToken();
        String createOrderUrl = BASE_URL + "/v2/checkout/orders";
        Map<String, Object> payload = new HashMap<>();
        Map<String, Object> amountMap = new HashMap<>();
        Map<String, Object> purchaseUnit = new HashMap<>();
        Map<String, Object> paymentSource = new HashMap<>();
        Map<String, Object> paypal = new HashMap<>();
        
        amountMap.put("currency_code", currencyCode); // Legacy equivalents — NVP: CURRENCYCODE ; SOAP: PaymentDetails.OrderTotal.currencyID
        amountMap.put("value", amount); // Legacy equivalents — NVP: AMT ; SOAP: PaymentDetails.OrderTotal
        
        purchaseUnit.put("amount", amountMap);
        
        paypal.put("vault_id", vaultId); // Used in place of legacy payload's BILLINGAGREEMENTID
        paymentSource.put("paypal", paypal);
        
        payload.put("intent", "AUTHORIZE"); // Legacy equivalents — NVP: PAYMENTACTION ; SOAP: PaymentAction
        payload.put("purchase_units", new Object[]{purchaseUnit});
        payload.put("payment_source", paymentSource);
        
        String jsonPayload = gson.toJson(payload);
        
        HttpRequest request = HttpRequest.newBuilder()
            .uri(URI.create(createOrderUrl))
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
        
        JsonObject jsonResponse = JsonParser.parseString(response.body()).getAsJsonObject();
        System.out.println("Order details: " + response.body());
        
        String authorizationId = jsonResponse.getAsJsonArray("purchase_units")
            .get(0).getAsJsonObject()
            .getAsJsonObject("payments")
            .getAsJsonArray("authorizations")
            .get(0).getAsJsonObject()
            .get("id").getAsString();
        
        System.out.println("Authorization ID: " + authorizationId);
        
        System.out.println("Capturing authorized payment...");
        String captureId = captureAuthorization(authorizationId);
        System.out.println("Capture ID: " + captureId);
        
        JsonObject result = new JsonObject();
        result.addProperty("capture_id", captureId);
        return result;
    } catch (Exception e) {
        System.out.println("Error: " + e.getMessage());
        throw e;
    }
}
```