#### OAuth2.0 Authentication

```java
private static final ConcurrentHashMap<String, TokenCacheEntry> tokenCache = new ConcurrentHashMap<>();
private static final Dotenv dotenv = Dotenv.configure()
    .directory(".")
    .ignoreIfMissing()
    .load();

private static class TokenCacheEntry {
    String accessToken;
    Instant expiresAt;
    
    TokenCacheEntry(String accessToken, Instant expiresAt) {
        this.accessToken = accessToken;
        this.expiresAt = expiresAt;
    }
}

// Authentication
public static String getAccessToken() throws IOException, InterruptedException {
    try {
        TokenCacheEntry cachedToken = tokenCache.get("access_token");
        if (cachedToken != null && cachedToken.expiresAt.isAfter(Instant.now())) {
            return cachedToken.accessToken;
        }
        
        String clientId = dotenv.get("PAYPAL_CLIENT_ID");
        String clientSecret = dotenv.get("PAYPAL_CLIENT_SECRET");
        String auth = Base64.getEncoder().encodeToString((clientId + ":" + clientSecret).getBytes(StandardCharsets.UTF_8));
        
        HttpRequest request = HttpRequest.newBuilder()
            .uri(URI.create(BASE_URL + "/v1/oauth2/token"))
            .header("Authorization", "Basic " + auth)
            .header("PayPal-Request-Id", UUID.randomUUID().toString())
            .header("Content-Type", "application/x-www-form-urlencoded")
            .POST(HttpRequest.BodyPublishers.ofString("grant_type=client_credentials"))
            .build();
        
        HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
        
        if (response.statusCode() >= 400) {
            JsonObject errorResponse = JsonParser.parseString(response.body()).getAsJsonObject();
            String debugId = errorResponse.has("debug_id") ? errorResponse.get("debug_id").getAsString() : "N/A";
            System.out.println("Error debug id: " + debugId);
            throw new IOException("Request failed with status code " + response.statusCode());
        }
        
        JsonObject tokenResponse = JsonParser.parseString(response.body()).getAsJsonObject();
        String accessToken = tokenResponse.get("access_token").getAsString();
        long expiresIn = tokenResponse.get("expires_in").getAsLong();
        
        TokenCacheEntry newCacheEntry = new TokenCacheEntry(
            accessToken,
            Instant.now().plus(expiresIn, ChronoUnit.SECONDS).minus(1, ChronoUnit.MINUTES) // 1 minute buffer
        );
        
        tokenCache.put("access_token", newCacheEntry);
        return newCacheEntry.accessToken;
    } catch (Exception e) {
        System.out.println("Error: " + e.getMessage());
        throw e;
    }
}
```