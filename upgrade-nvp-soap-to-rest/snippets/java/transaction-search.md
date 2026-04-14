#### Finding Transactions with TransactionID (legacy `GetTransactionDetails`)

```java
public static JsonObject viewTransaction(String transactionId) throws IOException, InterruptedException {
    try {
        String accessToken = getAccessToken();
        Instant now = Instant.now();
        Instant startTime = now.minus(7, ChronoUnit.DAYS);
        Instant endTime = now.minus(1, ChronoUnit.DAYS);
        
        // Truncate to milliseconds for PayPal API compatibility
        String startDate = startTime.truncatedTo(ChronoUnit.MILLIS).toString(); // Legacy equivalents — NVP: STARTDATE ; SOAP: StartDate
        String endDate = endTime.truncatedTo(ChronoUnit.MILLIS).toString(); // Legacy equivalents — NVP: ENDDATE ; SOAP: EndDate
        
        String url = String.format("%s/v1/reporting/transactions?start_date=%s&end_date=%s&transaction_id=%s",
            BASE_URL,
            URLEncoder.encode(startDate, StandardCharsets.UTF_8),
            URLEncoder.encode(endDate, StandardCharsets.UTF_8),
            URLEncoder.encode(transactionId, StandardCharsets.UTF_8) // Legacy equivalents — NVP: TRANSACTIONID ; SOAP: TransactionID
        );
        
        HttpRequest request = HttpRequest.newBuilder()
            .uri(URI.create(url))
            .header("Authorization", "Bearer " + accessToken)
            .header("Content-Type", "application/json")
            .GET()
            .build();
        
        HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
        
        if (response.statusCode() >= 400) {
            JsonObject errorResponse = JsonParser.parseString(response.body()).getAsJsonObject();
            String debugId = errorResponse.has("debug_id") ? errorResponse.get("debug_id").getAsString() : "N/A";
            System.out.println("Error debug id: " + debugId);
            throw new IOException("Request failed with status code " + response.statusCode());
        }
        
        return JsonParser.parseString(response.body()).getAsJsonObject();
    } catch (Exception e) {
        System.out.println("Error: " + e.getMessage());
        throw e;
    }
}
```

#### Searching Transactions between a start date and end date (legacy `TransactionSearch`)

```java
// Transaction Search and View
public static JsonObject searchTransactions() throws IOException, InterruptedException {
    try {
        String accessToken = getAccessToken();
        Instant now = Instant.now();
        Instant startTime = now.minus(7, ChronoUnit.DAYS);
        Instant endTime = now.minus(1, ChronoUnit.DAYS);
        
        // Truncate to milliseconds for PayPal API compatibility
        String startDate = startTime.truncatedTo(ChronoUnit.MILLIS).toString(); // Legacy equivalents — NVP: STARTDATE ; SOAP: StartDate
        String endDate = endTime.truncatedTo(ChronoUnit.MILLIS).toString(); // Legacy equivalents — NVP: ENDDATE ; SOAP: EndDate
        
        String url = String.format("%s/v1/reporting/transactions?start_date=%s&end_date=%s",
            BASE_URL,
            URLEncoder.encode(startDate, StandardCharsets.UTF_8),
            URLEncoder.encode(endDate, StandardCharsets.UTF_8)
        );
        
        HttpRequest request = HttpRequest.newBuilder()
            .uri(URI.create(url))
            .header("Authorization", "Bearer " + accessToken)
            .header("Content-Type", "application/json")
            .GET()
            .build();
        
        HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
        
        if (response.statusCode() >= 400) {
            JsonObject errorResponse = JsonParser.parseString(response.body()).getAsJsonObject();
            String debugId = errorResponse.has("debug_id") ? errorResponse.get("debug_id").getAsString() : "N/A";
            System.out.println("Error debug id: " + debugId);
            throw new IOException("Request failed with status code " + response.statusCode());
        }
        
        return JsonParser.parseString(response.body()).getAsJsonObject();
    } catch (Exception e) {
        System.out.println("Error: " + e.getMessage());
        throw e;
    }
}
```