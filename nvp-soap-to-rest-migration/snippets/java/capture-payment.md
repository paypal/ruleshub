#### Capturing full authorized amount

> Use the capture authorization endpoint with an empty request body to capture the entire authorized amount and treat it as the final capture.

```java
// Authorization Management
public static String captureAuthorization(String authorizationId) throws IOException, InterruptedException {
    try {
        String accessToken = getAccessToken();
        
        HttpRequest request = HttpRequest.newBuilder()
            .uri(URI.create(BASE_URL + "/v2/payments/authorizations/" + authorizationId + "/capture"))
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
        return jsonResponse.get("id").getAsString(); // Returns the ID assigned for the captured payment.
    } catch (Exception e) {
        System.out.println("Error: " + e.getMessage());
        throw e;
    }
}
```

#### Capturing part of the authorized amount

> For partial captures, specify amount to be captured and set "final_capture" explicitly to false.

```java
public static String captureAuthorizationPartial(String authorizationId, String amount, boolean finalCapture) throws IOException, InterruptedException {
    try {
        String accessToken = getAccessToken();
        
        Map<String, Object> payload = new HashMap<>();
        Map<String, String> amountMap = new HashMap<>();
        amountMap.put("currency_code", "USD"); // Legacy equivalents — NVP: CURRENCYCODE; SOAP: Amount.currencyID
        amountMap.put("value", amount); // Legacy equivalents — NVP: AMT; SOAP: Amount
        payload.put("amount", amountMap);
        payload.put("final_capture", finalCapture); // Legacy equivalents — NVP: COMPLETETYPE; SOAP: CompleteType
        
        String jsonPayload = gson.toJson(payload);
        
        HttpRequest request = HttpRequest.newBuilder()
            .uri(URI.create(BASE_URL + "/v2/payments/authorizations/" + authorizationId + "/capture"))
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
        return jsonResponse.get("id").getAsString(); // Returns the ID assigned for the captured payment.
    } catch (Exception e) {
        System.out.println("Error: " + e.getMessage());
        throw e;
    }
}
```