#### SNIPPET-URPP

**Update Subscription (replaces UpdateRecurringPaymentsProfile)**

> REST equivalent: `PATCH /v1/billing/subscriptions/{subscription_id}`

```java
import java.io.IOException;
import java.net.URI;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Update subscription
 * Legacy equivalents — NVP: UpdateRecurringPaymentsProfile; SOAP: UpdateRecurringPaymentsProfile
 * 
 * @param subscriptionId REST subscription ID (starts with I-). Legacy equivalents — NVP: PROFILEID; SOAP: ProfileID
 * @param patchOperations JSON Patch operations array
 * @return Updated subscription
 */
public static String updateSubscription(String subscriptionId, List<Map<String, Object>> patchOperations) throws IOException, InterruptedException {
    try {
        String accessToken = getAccessToken();
        String jsonPayload = gson.toJson(patchOperations);
        
        HttpRequest request = HttpRequest.newBuilder()
            .uri(URI.create(BASE_URL + "/v1/billing/subscriptions/" + subscriptionId))
            .header("Authorization", "Bearer " + accessToken)
            .header("PayPal-Request-Id", UUID.randomUUID().toString())
            .header("Content-Type", "application/json")
            .method("PATCH", HttpRequest.BodyPublishers.ofString(jsonPayload))
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

**Update billing amount (20% limit applies)**

```java
/**
 * Update subscription billing amount
 * Legacy equivalents — NVP: AMT; SOAP: PaymentPeriod.Amount
 * 
 * Note: Can only increase by 20% maximum per 180-day interval
 * Note: Cannot update within 3 days of scheduled billing date
 */
public static String updateBillingAmount(String subscriptionId, String amount, String currencyCode) throws IOException, InterruptedException {
    List<Map<String, Object>> patchOperations = new ArrayList<>();
    Map<String, Object> operation = new HashMap<>();
    operation.put("op", "replace");
    operation.put("path", "/plan/billing_cycles/@sequence==1/pricing_scheme/fixed_price");
    
    Map<String, Object> value = new HashMap<>();
    value.put("currency_code", currencyCode); // Legacy equivalents — NVP: CURRENCYCODE; SOAP: Amount.currencyID
    value.put("value", amount);                // Legacy equivalents — NVP: AMT; SOAP: PaymentPeriod.Amount
    operation.put("value", value);
    
    patchOperations.add(operation);
    
    return updateSubscription(subscriptionId, patchOperations);
}
```

**Update shipping amount**

```java
/**
 * Update subscription shipping amount
 * Legacy equivalents — NVP: SHIPPINGAMT; SOAP: PaymentPeriod.ShippingAmount
 */
public static String updateShippingAmount(String subscriptionId, String amount, String currencyCode) throws IOException, InterruptedException {
    List<Map<String, Object>> patchOperations = new ArrayList<>();
    Map<String, Object> operation = new HashMap<>();
    operation.put("op", "replace");
    operation.put("path", "/shipping_amount");
    
    Map<String, Object> value = new HashMap<>();
    value.put("currency_code", currencyCode);
    value.put("value", amount);  // Legacy equivalents — NVP: SHIPPINGAMT; SOAP: PaymentPeriod.ShippingAmount
    operation.put("value", value);
    
    patchOperations.add(operation);
    
    return updateSubscription(subscriptionId, patchOperations);
}
```
