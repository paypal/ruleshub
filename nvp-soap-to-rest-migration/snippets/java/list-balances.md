#### List all balances

```java
public static JsonObject listAllBalances() throws IOException, InterruptedException {
    try {
        String accessToken = getAccessToken();
        
        HttpRequest request = HttpRequest.newBuilder()
            .uri(URI.create(BASE_URL + "/v1/reporting/balances"))
            .header("Authorization", "Bearer " + accessToken)
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

> Note:When *RETURNALLCURRENCIES=0* in NVP, or *<ebl:ReturnAllCurrencies>false</ebl:ReturnAllCurrencies>* in SOAP, omit *currency_code* (or set it to your primary currency, e.g., USD).
