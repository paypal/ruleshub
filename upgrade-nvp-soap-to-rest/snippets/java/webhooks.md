#### Setting up webhook for persisting vaulted payment source id

> To learn more, refer to [Create Webhook](https://developer.paypal.com/docs/api/webhooks/v1/#webhooks_post) and [List webhooks](https://developer.paypal.com/docs/api/webhooks/v1/#webhooks_list).

```java
public static JsonObject listWebhooks() throws IOException, InterruptedException {
    try {
        String accessToken = getAccessToken();
        
        HttpRequest request = HttpRequest.newBuilder()
            .uri(URI.create(BASE_URL + "/v1/notifications/webhooks"))
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
    
public static JsonObject createWebhook(String webhookUrl) throws IOException, InterruptedException {
    try {
        String accessToken = getAccessToken();
        
        // First, check if webhook already exists
        JsonObject existingWebhooks = listWebhooks();
        if (existingWebhooks.has("webhooks")) {
            JsonArray webhooks = existingWebhooks.getAsJsonArray("webhooks");
            for (JsonElement webhook : webhooks) {
                JsonObject webhookObj = webhook.getAsJsonObject();
                if (webhookObj.has("url") && webhookObj.get("url").getAsString().equals(webhookUrl)) {
                    System.out.println("Found existing webhook:");
                    System.out.println(gson.toJson(webhookObj));
                    return webhookObj;
                }
            }
        }
        
        String createWebhookUrl = BASE_URL + "/v1/notifications/webhooks";
        
        Map<String, Object> payload = new HashMap<>();
        Map<String, String> eventType = new HashMap<>();
        eventType.put("name", "VAULT.PAYMENT-TOKEN.CREATED");
        
        payload.put("url", webhookUrl);
        payload.put("event_types", new Object[]{eventType});
        
        String jsonPayload = gson.toJson(payload);
        
        HttpRequest request = HttpRequest.newBuilder()
            .uri(URI.create(createWebhookUrl))
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
        
        return JsonParser.parseString(response.body()).getAsJsonObject();
    } catch (Exception e) {
        System.out.println("Error: " + e.getMessage());
        throw e;
    }
}
```

#### Webhook signature verification

> To learn more, refer to [Verify Webhook Signatures](https://developer.paypal.com/docs/api/webhooks/v1/#verify-webhook-signature_post).

```java
public static boolean verifyWebhookSignature(String webhookId, Map<String, String> headers, String body) throws IOException, InterruptedException {
    try {
        String accessToken = getAccessToken();
        Map<String, Object> verificationData = new HashMap<>();
        verificationData.put("auth_algo", headers.get("paypal-auth-algo"));
        verificationData.put("cert_url", headers.get("paypal-cert-url"));
        verificationData.put("transmission_id", headers.get("paypal-transmission-id"));
        verificationData.put("transmission_sig", headers.get("paypal-transmission-sig"));
        verificationData.put("transmission_time", headers.get("paypal-transmission-time"));
        verificationData.put("webhook_id", webhookId);
        verificationData.put("webhook_event", JsonParser.parseString(body));
        
        String jsonPayload = gson.toJson(verificationData);
        
        HttpRequest request = HttpRequest.newBuilder()
            .uri(URI.create(BASE_URL + "/v1/notifications/verify-webhook-signature"))
            .header("Authorization", "Bearer " + accessToken)
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
        
        JsonObject result = JsonParser.parseString(response.body()).getAsJsonObject();
        return result.has("verification_status") && result.get("verification_status").getAsString().equals("SUCCESS");
    } catch (Exception e) {
        System.out.println("Error: " + e.getMessage());
        throw e;
    }
}
```

#### Webhook handler to capture and store "VaultId" from the event data

> To learn more, refer to [Show event notification details](https://developer.paypal.com/docs/api/webhooks/v1/#webhooks-events_get).

```java
public static String webhookHandler(String webhookId, Map<String, String> headers, String body) throws IOException, InterruptedException {
    try {
        boolean isVerified = verifyWebhookSignature(webhookId, headers, body);
        if (!isVerified) {
            throw new IllegalStateException("Webhook verification failed");
        }
        
        JsonObject eventData = JsonParser.parseString(body).getAsJsonObject();
        if (eventData.has("event_type") && 
            eventData.get("event_type").getAsString().equals("VAULT.PAYMENT-TOKEN.CREATED")) {
            // This is the unique identifier associated with the customer's payment source stored in the PayPal Vault.
            // This "vaultId" can be used to make future payments without needing customer's consent.
            String vaultId = eventData.getAsJsonObject("resource").get("id").getAsString();
            // TODO: Save the vaultId to the database.
            return vaultId;
        }
        
        throw new IllegalStateException("Invalid webhook event");
    } catch (Exception e) {
        System.out.println("Error: " + e.getMessage());
        throw e;
    }
}
```