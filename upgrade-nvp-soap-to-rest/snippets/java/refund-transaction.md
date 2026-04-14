#### Refund the captured amount

> Send an empty request body to initiate a refund for the amount equal to [captured amount – refunds already issued].

```java
public static String refundTransaction(String transactionId) throws IOException, InterruptedException {
    try {
        String accessToken = getAccessToken();
        
        HttpRequest request = HttpRequest.newBuilder()
            .uri(URI.create(BASE_URL + "/v2/payments/captures/" + transactionId + "/refund"))
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
        return jsonResponse.get("id").getAsString();
    } catch (Exception e) {
        System.out.println("Error: " + e.getMessage());
        throw e;
    }
}
```

#### Refund specific amount

> Include the specific amount in the request body to initiate a refund for that amount against the capture.

```java
public static String refundTransactionPartial(String transactionId, String amount) throws IOException, InterruptedException {
    try {
        String accessToken = getAccessToken();
        Map<String, Object> payload = new HashMap<>();
        Map<String, String> amountMap = new HashMap<>();
        amountMap.put("currency_code", "USD"); // Legacy equivalents — NVP: CURRENCYCODE ; SOAP: Amount.currencyID
        amountMap.put("value", amount); // Legacy equivalents — NVP: AMT ; SOAP: Amount
        payload.put("amount", amountMap);
        
        String jsonPayload = gson.toJson(payload);
        
        HttpRequest request = HttpRequest.newBuilder()
            .uri(URI.create(BASE_URL + "/v2/payments/captures/" + transactionId + "/refund"))
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
        return jsonResponse.get("id").getAsString();
    } catch (Exception e) {
        System.out.println("Error: " + e.getMessage());
        throw e;
    }
}
```