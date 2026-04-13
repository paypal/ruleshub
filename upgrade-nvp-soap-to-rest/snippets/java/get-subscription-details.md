#### SNIPPET-GRPPD

**Get Subscription Details (replaces GetRecurringPaymentsProfileDetails)**

> REST equivalent: `GET /v1/billing/subscriptions/{subscription_id}`

```java
import java.io.IOException;
import java.net.URI;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.util.UUID;

/**
 * Get subscription details
 * Legacy equivalents — NVP: GetRecurringPaymentsProfileDetails; SOAP: GetRecurringPaymentsProfileDetails
 * 
 * @param subscriptionId REST subscription ID (starts with I-). Legacy equivalents — NVP: PROFILEID; SOAP: ProfileID
 * @return Subscription details including status, billing_info, subscriber
 */
public static String getSubscriptionDetails(String subscriptionId) throws IOException, InterruptedException {
    try {
        String accessToken = getAccessToken();
        
        HttpRequest request = HttpRequest.newBuilder()
            .uri(URI.create(BASE_URL + "/v1/billing/subscriptions/" + subscriptionId))
            .header("Authorization", "Bearer " + accessToken)
            .header("PayPal-Request-Id", UUID.randomUUID().toString())
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
        
        return response.body();
    } catch (Exception e) {
        System.out.println("Error: " + e.getMessage());
        throw e;
    }
}
```

**Get Plan Details (optional - if full billing cycle config needed)**

> Call this if subscription response doesn't include full billing cycle configuration

```java
/**
 * Get plan details
 * 
 * @param planId Plan ID from subscription.plan_id
 */
public static String getPlanDetails(String planId) throws IOException, InterruptedException {
    try {
        String accessToken = getAccessToken();
        
        HttpRequest request = HttpRequest.newBuilder()
            .uri(URI.create(BASE_URL + "/v1/billing/plans/" + planId))
            .header("Authorization", "Bearer " + accessToken)
            .header("PayPal-Request-Id", UUID.randomUUID().toString())
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
        
        return response.body();
    } catch (Exception e) {
        System.out.println("Error: " + e.getMessage());
        throw e;
    }
}
```
