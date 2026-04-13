#### SNIPPET-CRPP-SETUP

**One-Time Setup (Run ONCE during upgrade)**

```java
// SetupSubscription.java
// Compile and run: javac SetupSubscription.java && java SetupSubscription
// Requires: Add org.json and okhttp dependencies to your project

import okhttp3.*;
import org.json.*;
import java.io.*;
import java.nio.file.*;
import java.util.UUID;

public class SetupSubscription {
    
    private static final String BASE_URL = System.getenv("PAYPAL_MODE") != null && 
        System.getenv("PAYPAL_MODE").equals("live") 
        ? "https://api-m.paypal.com" 
        : "https://api-m.sandbox.paypal.com";
    
    private static final OkHttpClient client = new OkHttpClient();
    private static final MediaType JSON = MediaType.get("application/json; charset=utf-8");
    
    // Include getPayPalAccessToken() from OAuth2 snippet
    
    public static void main(String[] args) {
        try {
            setupSubscriptionPlan();
        } catch (Exception e) {
            System.err.println("Setup failed: " + e.getMessage());
            e.printStackTrace();
            System.exit(1);
        }
    }
    
    public static void setupSubscriptionPlan() throws Exception {
        String accessToken = getPayPalAccessToken();
        
        // Step 1: Create Product
        JSONObject productData = new JSONObject()
            .put("name", "Premium Subscription")  // Legacy equivalents — NVP: DESC; SOAP: ProfileDetails.Description
            .put("type", "SERVICE");  // Legacy equivalents — NVP: L_PAYMENTREQUEST_0_ITEMCATEGORY0 (Digital→"DIGITAL", Physical→"PHYSICAL", default "SERVICE")
        
        Request productRequest = new Request.Builder()
            .url(BASE_URL + "/v1/catalogs/products")
            .addHeader("Authorization", "Bearer " + accessToken)
            .addHeader("PayPal-Request-Id", UUID.randomUUID().toString())
            .addHeader("Content-Type", "application/json")
            .post(RequestBody.create(productData.toString(), JSON))
            .build();
        
        Response productResponse = client.newCall(productRequest).execute();
        if (!productResponse.isSuccessful()) {
            throw new IOException("Failed to create product: " + productResponse.body().string());
        }
        
        JSONObject productResult = new JSONObject(productResponse.body().string());
        String productId = productResult.getString("id");
        System.out.println("Product created: " + productId);
        
        // Step 2: Create Plan
        // Build billing_cycles based on legacy code
        JSONArray billingCycles = new JSONArray();
        int sequence = 1;
        
        // Add TRIAL cycle ONLY if legacy has TRIALBILLINGPERIOD
        // Uncomment if legacy code has trial period:
        // billingCycles.put(new JSONObject()
        //     .put("tenure_type", "TRIAL")
        //     .put("sequence", sequence++)
        //     .put("total_cycles", 1)  // Legacy equivalents — NVP: TRIALTOTALBILLINGCYCLES
        //     .put("frequency", new JSONObject()
        //         .put("interval_unit", "DAY")   // Legacy equivalents — NVP: TRIALBILLINGPERIOD
        //         .put("interval_count", 7))     // Legacy equivalents — NVP: TRIALBILLINGFREQUENCY
        //     // Omit pricing_scheme for free trial (TRIALAMT = 0)
        // );
        
        // Add REGULAR cycle (always present)
        billingCycles.put(new JSONObject()
            .put("tenure_type", "REGULAR")
            .put("sequence", sequence)
            .put("total_cycles", 0)  // Legacy equivalents — NVP: TOTALBILLINGCYCLES (0 = unlimited)
            .put("frequency", new JSONObject()
                .put("interval_unit", "MONTH")   // Legacy equivalents — NVP: BILLINGPERIOD
                .put("interval_count", 1))       // Legacy equivalents — NVP: BILLINGFREQUENCY
            .put("pricing_scheme", new JSONObject()
                .put("fixed_price", new JSONObject()
                    .put("value", "29.99")       // Legacy equivalents — NVP: AMT
                    .put("currency_code", "USD")))  // Legacy equivalents — NVP: CURRENCYCODE
        );
        
        // Build payment_preferences
        JSONObject paymentPreferences = new JSONObject()
            .put("auto_bill_outstanding", true)   // Legacy equivalents — NVP: AUTOBILLOUTAMT
            .put("payment_failure_threshold", 3); // Legacy equivalents — NVP: MAXFAILEDPAYMENTS
        
        // Include setup_fee for:
        // - FLOW 1 (Subscription Only): if INITAMT > 0
        // - FLOW 2 (Subscription + One-Time): map PAYMENTREQUEST_0_AMT
        // Uncomment if legacy has initial/one-time amount:
        // paymentPreferences.put("setup_fee", new JSONObject()
        //     .put("value", "49.99")       // Legacy equivalents — NVP: INITAMT or PAYMENTREQUEST_0_AMT
        //     .put("currency_code", "USD"));
        
        JSONObject planData = new JSONObject()
            .put("product_id", productId)
            .put("name", "Monthly Premium Plan")  // Legacy equivalents — NVP: DESC
            .put("billing_cycles", billingCycles)
            .put("payment_preferences", paymentPreferences);
        
        Request planRequest = new Request.Builder()
            .url(BASE_URL + "/v1/billing/plans")
            .addHeader("Authorization", "Bearer " + accessToken)
            .addHeader("PayPal-Request-Id", UUID.randomUUID().toString())
            .addHeader("Content-Type", "application/json")
            .post(RequestBody.create(planData.toString(), JSON))
            .build();
        
        Response planResponse = client.newCall(planRequest).execute();
        if (!planResponse.isSuccessful()) {
            throw new IOException("Failed to create plan: " + planResponse.body().string());
        }
        
        JSONObject planResult = new JSONObject(planResponse.body().string());
        String planId = planResult.getString("id");
        
        // Save to config file
        Files.createDirectories(Paths.get("./config"));
        JSONObject config = new JSONObject()
            .put("product_id", productId)
            .put("plan_id", planId);
        Files.writeString(Paths.get("./config/paypal-subscriptions.json"), config.toString(2));
        
        System.out.println("Setup complete! Product: " + productId + ", Plan: " + planId);
    }
}
```

#### SNIPPET-CRPP-RUNTIME

**Per-Customer Flow (Each Customer Subscription)**

```java
// SubscriptionService.java
import okhttp3.*;
import org.json.*;
import java.io.*;
import java.nio.file.*;
import java.util.UUID;

public class SubscriptionService {
    
    private static final String BASE_URL = System.getenv("PAYPAL_MODE") != null && 
        System.getenv("PAYPAL_MODE").equals("live") 
        ? "https://api-m.paypal.com" 
        : "https://api-m.sandbox.paypal.com";
    
    private static final OkHttpClient client = new OkHttpClient();
    private static final MediaType JSON_TYPE = MediaType.get("application/json; charset=utf-8");
    
    private static String PLAN_ID;
    
    // Load config from One-Time Setup
    // Uses user.dir (project root where you run 'java' or 'mvn') to find config
    // This works even if this class is in a subfolder like src/main/java/services/
    private static Path getConfigPath() {
        String envPath = System.getenv("PAYPAL_CONFIG_PATH");
        if (envPath != null) return Paths.get(envPath);
        return Paths.get(System.getProperty("user.dir"), "config", "paypal-subscriptions.json");
    }
    
    static {
        Path configPath = getConfigPath();
        try {
            String configContent = Files.readString(configPath);
            JSONObject config = new JSONObject(configContent);
            PLAN_ID = config.getString("plan_id");
        } catch (IOException e) {
            throw new RuntimeException("Config not found at " + configPath + ". Run SetupSubscription first, or set PAYPAL_CONFIG_PATH env var.", e);
        }
    }
    
    // Include getPayPalAccessToken() from OAuth2 snippet
    
    // RUNTIME FLOW:
    // 1. User clicks Subscribe → createSubscription() → redirect to PayPal
    // 2. User approves on PayPal → PayPal redirects to return_url
    // 3. Return handler → check status → activateSubscription()
    
    /**
     * Create subscription and get approval URL.
     * @param returnUrl Where PayPal redirects after approval (Legacy: NVP RETURNURL)
     * @param cancelUrl Where PayPal redirects if cancelled (Legacy: NVP CANCELURL)
     * @param customId Your reference ID (Legacy: NVP PROFILEREFERENCE)
     * @param startTime ISO 8601 start date (Legacy: NVP PROFILESTARTDATE). If null, starts immediately.
     */
    public static SubscriptionResult createSubscription(String returnUrl, String cancelUrl, 
                                                         String customId, String startTime) throws Exception {
        String accessToken = getPayPalAccessToken();
        
        JSONObject subscriptionData = new JSONObject()
            .put("plan_id", PLAN_ID)  // From config - NOT created per customer
            .put("application_context", new JSONObject()
                .put("user_action", "CONTINUE")        // CRITICAL: Requires explicit activation after approval
                .put("return_url", returnUrl)
                .put("cancel_url", cancelUrl)
                .put("brand_name", "Your Company")     // Legacy equivalents — NVP: BRANDNAME
                .put("shipping_preference", "NO_SHIPPING"));  // Legacy equivalents — NVP: NOSHIPPING
        
        if (customId != null) subscriptionData.put("custom_id", customId);
        if (startTime != null) subscriptionData.put("start_time", startTime);
        
        Request request = new Request.Builder()
            .url(BASE_URL + "/v1/billing/subscriptions")
            .addHeader("Authorization", "Bearer " + accessToken)
            .addHeader("PayPal-Request-Id", UUID.randomUUID().toString())
            .addHeader("Content-Type", "application/json")
            .post(RequestBody.create(subscriptionData.toString(), JSON_TYPE))
            .build();
        
        Response response = client.newCall(request).execute();
        if (!response.isSuccessful()) {
            throw new IOException("Failed to create subscription: " + response.body().string());
        }
        
        JSONObject result = new JSONObject(response.body().string());
        String subscriptionId = result.getString("id");
        String approvalUrl = null;
        
        JSONArray links = result.getJSONArray("links");
        for (int i = 0; i < links.length(); i++) {
            JSONObject link = links.getJSONObject(i);
            if ("approve".equals(link.getString("rel"))) {
                approvalUrl = link.getString("href");
                break;
            }
        }
        
        return new SubscriptionResult(subscriptionId, approvalUrl);
    }
    
    /**
     * Get subscription status and details.
     */
    public static JSONObject getSubscriptionDetails(String subscriptionId) throws Exception {
        String accessToken = getPayPalAccessToken();
        
        Request request = new Request.Builder()
            .url(BASE_URL + "/v1/billing/subscriptions/" + subscriptionId)
            .addHeader("Authorization", "Bearer " + accessToken)
            .get()
            .build();
        
        Response response = client.newCall(request).execute();
        if (!response.isSuccessful()) {
            throw new IOException("Failed to get subscription: " + response.body().string());
        }
        
        return new JSONObject(response.body().string());
    }
    
    /**
     * Activate subscription after user approval.
     * CRITICAL: Only call when status is 'APPROVED' (not 'APPROVAL_PENDING').
     * Status flow: APPROVAL_PENDING → (user approves) → APPROVED → (activate) → ACTIVE
     */
    public static void activateSubscription(String subscriptionId) throws Exception {
        String accessToken = getPayPalAccessToken();
        
        JSONObject activateData = new JSONObject()
            .put("reason", "Customer approved subscription");
        
        Request request = new Request.Builder()
            .url(BASE_URL + "/v1/billing/subscriptions/" + subscriptionId + "/activate")
            .addHeader("Authorization", "Bearer " + accessToken)
            .addHeader("PayPal-Request-Id", UUID.randomUUID().toString())
            .addHeader("Content-Type", "application/json")
            .post(RequestBody.create(activateData.toString(), JSON_TYPE))
            .build();
        
        Response response = client.newCall(request).execute();
        if (!response.isSuccessful()) {
            throw new IOException("Failed to activate subscription: " + response.body().string());
        }
    }
    
    /**
     * Handle return from PayPal approval page.
     * Call this in your return_url route handler.
     */
    public static SubscriptionReturnResult handleSubscriptionReturn(String subscriptionId) throws Exception {
        JSONObject details = getSubscriptionDetails(subscriptionId);
        String status = details.getString("status");
        
        if ("APPROVED".equals(status)) {
            activateSubscription(subscriptionId);
            return new SubscriptionReturnResult(true, "ACTIVE", null);
        } else if ("ACTIVE".equals(status)) {
            return new SubscriptionReturnResult(true, "ACTIVE", "Already activated");
        } else {
            return new SubscriptionReturnResult(false, status, "Unexpected status: " + status);
        }
    }
    
    // Helper classes
    public static class SubscriptionResult {
        public final String subscriptionId;
        public final String approvalUrl;
        
        public SubscriptionResult(String subscriptionId, String approvalUrl) {
            this.subscriptionId = subscriptionId;
            this.approvalUrl = approvalUrl;
        }
    }
    
    public static class SubscriptionReturnResult {
        public final boolean success;
        public final String status;
        public final String message;
        
        public SubscriptionReturnResult(boolean success, String status, String message) {
            this.success = success;
            this.status = status;
            this.message = message;
        }
    }
}
```

#### SNIPPET-CRPP-TRIAL-EXAMPLE

**Example: Plan with 7-day free trial then $29.99/month**

```java
// Legacy: TRIALBILLINGPERIOD=Day, TRIALBILLINGFREQUENCY=7, TRIALAMT=0, TRIALTOTALBILLINGCYCLES=1
//         BILLINGPERIOD=Month, BILLINGFREQUENCY=1, AMT=29.99, TOTALBILLINGCYCLES=0
JSONArray billingCycles = new JSONArray()
    .put(new JSONObject()
        .put("tenure_type", "TRIAL")
        .put("sequence", 1)
        .put("total_cycles", 1)
        .put("frequency", new JSONObject()
            .put("interval_unit", "DAY")
            .put("interval_count", 7)))
        // No pricing_scheme = free trial (TRIALAMT = 0)
    .put(new JSONObject()
        .put("tenure_type", "REGULAR")
        .put("sequence", 2)
        .put("total_cycles", 0)
        .put("frequency", new JSONObject()
            .put("interval_unit", "MONTH")
            .put("interval_count", 1))
        .put("pricing_scheme", new JSONObject()
            .put("fixed_price", new JSONObject()
                .put("value", "29.99")
                .put("currency_code", "USD"))));
```

#### SNIPPET-CRPP-SETUP-FEE-EXAMPLE

**Example: $49.99 setup fee + $29.99/month recurring**

```java
// Legacy FLOW 1: INITAMT=49.99 → setup_fee
// Legacy FLOW 2: PAYMENTREQUEST_0_AMT=49.99 → setup_fee
JSONObject paymentPreferences = new JSONObject()
    .put("auto_bill_outstanding", true)
    .put("payment_failure_threshold", 3)
    .put("setup_fee", new JSONObject()
        .put("value", "49.99")       // Legacy: NVP INITAMT or PAYMENTREQUEST_0_AMT
        .put("currency_code", "USD"));

JSONArray billingCycles = new JSONArray()
    .put(new JSONObject()
        .put("tenure_type", "REGULAR")
        .put("sequence", 1)
        .put("total_cycles", 0)
        .put("frequency", new JSONObject()
            .put("interval_unit", "MONTH")
            .put("interval_count", 1))
        .put("pricing_scheme", new JSONObject()
            .put("fixed_price", new JSONObject()
                .put("value", "29.99")    // Legacy: NVP AMT
                .put("currency_code", "USD"))));
```

#### SNIPPET-CRPP-TRIAL-SETUPFEE-EXAMPLE

**Example: $49.99 setup fee + 7-day free trial + $29.99/month recurring**

```java
// Legacy: INITAMT=49.99, TRIALBILLINGPERIOD=Day, TRIALBILLINGFREQUENCY=7, TRIALAMT=0, TRIALTOTALBILLINGCYCLES=1
//         BILLINGPERIOD=Month, BILLINGFREQUENCY=1, AMT=29.99, TOTALBILLINGCYCLES=0
// Charge sequence: setup_fee at activation → trial period → regular billing

JSONArray billingCycles = new JSONArray()
    .put(new JSONObject()
        .put("tenure_type", "TRIAL")
        .put("sequence", 1)
        .put("total_cycles", 1)
        .put("frequency", new JSONObject()
            .put("interval_unit", "DAY")
            .put("interval_count", 7)))
        // No pricing_scheme = free trial (TRIALAMT = 0)
    .put(new JSONObject()
        .put("tenure_type", "REGULAR")
        .put("sequence", 2)
        .put("total_cycles", 0)
        .put("frequency", new JSONObject()
            .put("interval_unit", "MONTH")
            .put("interval_count", 1))
        .put("pricing_scheme", new JSONObject()
            .put("fixed_price", new JSONObject()
                .put("value", "29.99")    // Legacy: NVP AMT
                .put("currency_code", "USD"))));

JSONObject paymentPreferences = new JSONObject()
    .put("auto_bill_outstanding", true)
    .put("payment_failure_threshold", 3)
    .put("setup_fee", new JSONObject()
        .put("value", "49.99")       // Legacy: NVP INITAMT - charged at activation, BEFORE trial starts
        .put("currency_code", "USD"));
```
