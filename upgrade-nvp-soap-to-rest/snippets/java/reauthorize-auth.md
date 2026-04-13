#### Reauthorizing the full amount that was authorized before

> Note: Sending a reauthorization request with an empty body will reauthorize the full amount of the previously authorized order.

```java
// The authorizationId parameter must be the original identifier returned when the order was first authorized.
public static String reauthorizeAuth(String authorizationId) throws IOException, InterruptedException {
    try {
        String accessToken = getAccessToken();
        
        HttpRequest request = HttpRequest.newBuilder()
            .uri(URI.create(BASE_URL + "/v2/payments/authorizations/" + authorizationId + "/reauthorize"))
            .header("Authorization", "Bearer " + accessToken)
            .header("PayPal-Request-Id", UUID.randomUUID().toString())
            .header("Content-Type", "application/json")
            .POST(HttpRequest.BodyPublishers.ofString("{}"))
            .build();
        
        HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
        
        if (response.statusCode() >= 400) {
            JsonObject errorResponse = JsonParser.parseString(response.body()).getAsJsonObject();
            String debugId = errorResponse.has("debug_id") ? errorResponse.get("debug_id").getAsString() : "N/A";
            System.out.println("Error debug id: " + debugId);
            throw new IOException("Request failed with status code " + response.statusCode());
        }
        
        JsonObject jsonResponse = JsonParser.parseString(response.body()).getAsJsonObject();
        return jsonResponse.get("id").getAsString(); // ID for the reauthorized authorization.
    } catch (Exception e) {
        System.out.println("Error: " + e.getMessage());
        throw e;
    }
}
```

#### Reauthorizing part of the amount that was authorized before

> Note: Include the amount field in the reauthorization request body to reauthorize a specific amount, which must not exceed the originally authorized value.

```java
public static String reauthorizeAuthPartial(String authorizationId, String amount) throws IOException, InterruptedException {
    try {
        String accessToken = getAccessToken();
        
        Map<String, Object> payload = new HashMap<>();
        Map<String, String> amountMap = new HashMap<>();
        amountMap.put("currency_code", "USD"); // Legacy equivalents — NVP: CURRENCYCODE; SOAP: Not Supported
        amountMap.put("value", amount); // Legacy equivalents — NVP: AMT; SOAP: Amount
        payload.put("amount", amountMap);
        
        String jsonPayload = gson.toJson(payload);
        
        HttpRequest request = HttpRequest.newBuilder()
            .uri(URI.create(BASE_URL + "/v2/payments/authorizations/" + authorizationId + "/reauthorize"))
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
        return jsonResponse.get("id").getAsString(); // ID for the reauthorized authorization.
    } catch (Exception e) {
        System.out.println("Error: " + e.getMessage());
        throw e;
    }
}
```