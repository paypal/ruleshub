#### Capturing payment for an Order

> Note: Always have an empty payload as request body while capturing payment for an order.

```java
public static String captureOrder(String orderId) throws IOException, InterruptedException {
    try {
        String accessToken = getAccessToken();
        
        HttpRequest request = HttpRequest.newBuilder()
            .uri(URI.create(BASE_URL + "/v2/checkout/orders/" + orderId + "/capture"))
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
        
        System.out.println("Capture details for Order ID: " + orderId);
        System.out.println(response.body());
        
        JsonObject jsonResponse = JsonParser.parseString(response.body()).getAsJsonObject();
        return jsonResponse.getAsJsonArray("purchase_units")
            .get(0).getAsJsonObject()
            .getAsJsonObject("payments")
            .getAsJsonArray("captures")
            .get(0).getAsJsonObject()
            .get("id").getAsString();
    } catch (Exception e) {
        System.out.println("Error: " + e.getMessage());
        throw e;
    }
}
```

#### Authorizing an Order

```java
public static String authorizeOrder(String orderId) throws IOException, InterruptedException {
    try {
        String accessToken = getAccessToken();
        
        HttpRequest request = HttpRequest.newBuilder()
            .uri(URI.create(BASE_URL + "/v2/checkout/orders/" + orderId + "/authorize"))
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
        return jsonResponse.getAsJsonArray("purchase_units")
            .get(0).getAsJsonObject()
            .getAsJsonObject("payments")
            .getAsJsonArray("authorizations")
            .get(0).getAsJsonObject()
            .get("id").getAsString();
    } catch (Exception e) {
        System.out.println("Error: " + e.getMessage());
        throw e;
    }
}
```