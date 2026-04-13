#### SNIPPET-MRPPS

**Manage Subscription Status (replaces ManageRecurringPaymentsProfileStatus)**

> REST has three separate endpoints based on action:
> - Suspend: `POST /v1/billing/subscriptions/{id}/suspend`
> - Cancel: `POST /v1/billing/subscriptions/{id}/cancel`
> - Reactivate: `POST /v1/billing/subscriptions/{id}/activate`

**Suspend Subscription**

```java
import java.io.IOException;
import java.net.URI;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.util.HashMap;
import java.util.Map;
import java.util.UUID;

/**
 * Suspend subscription (temporarily pause billing)
 * Legacy equivalents — NVP: ManageRecurringPaymentsProfileStatus with ACTION=Suspend
 * 
 * @param subscriptionId REST subscription ID (starts with I-). Legacy equivalents — NVP: PROFILEID; SOAP: ProfileID
 * @param reason Reason for suspension (required in REST). Legacy equivalents — NVP: NOTE; SOAP: Note
 */
public static void suspendSubscription(String subscriptionId, String reason) throws IOException, InterruptedException {
    try {
        String accessToken = getAccessToken();
        
        Map<String, Object> payload = new HashMap<>();
        payload.put("reason", reason);
        String jsonPayload = gson.toJson(payload);
        
        HttpRequest request = HttpRequest.newBuilder()
            .uri(URI.create(BASE_URL + "/v1/billing/subscriptions/" + subscriptionId + "/suspend"))
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
        
        System.out.println("Subscription suspended");
    } catch (Exception e) {
        System.out.println("Error: " + e.getMessage());
        throw e;
    }
}
```

**Cancel Subscription**

```java
/**
 * Cancel subscription (permanently end - cannot be undone)
 * Legacy equivalents — NVP: ManageRecurringPaymentsProfileStatus with ACTION=Cancel
 * 
 * @param subscriptionId REST subscription ID. Legacy equivalents — NVP: PROFILEID; SOAP: ProfileID
 * @param reason Reason for cancellation (required in REST). Legacy equivalents — NVP: NOTE; SOAP: Note
 */
public static void cancelSubscription(String subscriptionId, String reason) throws IOException, InterruptedException {
    try {
        String accessToken = getAccessToken();
        
        Map<String, Object> payload = new HashMap<>();
        payload.put("reason", reason);
        String jsonPayload = gson.toJson(payload);
        
        HttpRequest request = HttpRequest.newBuilder()
            .uri(URI.create(BASE_URL + "/v1/billing/subscriptions/" + subscriptionId + "/cancel"))
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
        
        System.out.println("Subscription cancelled");
    } catch (Exception e) {
        System.out.println("Error: " + e.getMessage());
        throw e;
    }
}
```

**Reactivate Subscription**

```java
/**
 * Reactivate subscription (resume from suspended state)
 * Legacy equivalents — NVP: ManageRecurringPaymentsProfileStatus with ACTION=Reactivate
 * Note: This is the same endpoint used for initial activation after buyer approval
 * 
 * @param subscriptionId REST subscription ID. Legacy equivalents — NVP: PROFILEID; SOAP: ProfileID
 * @param reason Reason for reactivation. Legacy equivalents — NVP: NOTE; SOAP: Note
 */
public static void reactivateSubscription(String subscriptionId, String reason) throws IOException, InterruptedException {
    try {
        String accessToken = getAccessToken();
        
        Map<String, Object> payload = new HashMap<>();
        payload.put("reason", reason);
        String jsonPayload = gson.toJson(payload);
        
        HttpRequest request = HttpRequest.newBuilder()
            .uri(URI.create(BASE_URL + "/v1/billing/subscriptions/" + subscriptionId + "/activate"))
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
        
        System.out.println("Subscription reactivated");
    } catch (Exception e) {
        System.out.println("Error: " + e.getMessage());
        throw e;
    }
}
```
