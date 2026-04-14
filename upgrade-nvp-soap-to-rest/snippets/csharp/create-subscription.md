#### SNIPPET-CRPP-SETUP

**One-Time Setup (Run ONCE during upgrade)**

```csharp
// SetupSubscription.cs
// Run: dotnet add package RestSharp DotNetEnv && dotnet run

using System;
using System.IO;
using System.Text.Json;
using RestSharp;
using DotNetEnv;

class SetupSubscription
{
    private static readonly string BaseUrl = Environment.GetEnvironmentVariable("PAYPAL_MODE") == "live"
        ? "https://api-m.paypal.com"
        : "https://api-m.sandbox.paypal.com";

    // Include GetPayPalAccessToken() from OAuth2 snippet

    static void Main(string[] args)
    {
        Env.Load();
        
        try
        {
            SetupSubscriptionPlan();
        }
        catch (Exception ex)
        {
            Console.WriteLine($"Setup failed: {ex.Message}");
            Environment.Exit(1);
        }
    }

    static void SetupSubscriptionPlan()
    {
        var accessToken = GetPayPalAccessToken();
        var client = new RestClient(BaseUrl);

        // Step 1: Create Product
        var productRequest = new RestRequest("/v1/catalogs/products", Method.Post);
        productRequest.AddHeader("Authorization", $"Bearer {accessToken}");
        productRequest.AddHeader("PayPal-Request-Id", Guid.NewGuid().ToString());
        productRequest.AddHeader("Content-Type", "application/json");
        productRequest.AddJsonBody(new
        {
            name = "Premium Subscription",  // Legacy equivalents — NVP: DESC; SOAP: ProfileDetails.Description
            type = "SERVICE"  // Legacy equivalents — NVP: L_PAYMENTREQUEST_0_ITEMCATEGORY0 (Digital→"DIGITAL", Physical→"PHYSICAL", default "SERVICE")
        });

        var productResponse = client.Execute(productRequest);
        if (!productResponse.IsSuccessful)
        {
            throw new Exception($"Failed to create product: {productResponse.Content}");
        }

        var productResult = JsonSerializer.Deserialize<JsonElement>(productResponse.Content);
        var productId = productResult.GetProperty("id").GetString();
        Console.WriteLine($"Product created: {productId}");

        // Step 2: Create Plan
        // Build billing_cycles based on legacy code
        var billingCycles = new List<object>();
        var sequence = 1;

        // Add TRIAL cycle ONLY if legacy has TRIALBILLINGPERIOD
        // Uncomment if legacy code has trial period:
        // billingCycles.Add(new
        // {
        //     tenure_type = "TRIAL",
        //     sequence = sequence++,
        //     total_cycles = 1,  // Legacy equivalents — NVP: TRIALTOTALBILLINGCYCLES
        //     frequency = new { interval_unit = "DAY", interval_count = 7 }  // Legacy equivalents — NVP: TRIALBILLINGPERIOD, TRIALBILLINGFREQUENCY
        //     // Omit pricing_scheme for free trial (TRIALAMT = 0)
        // });

        // Add REGULAR cycle (always present)
        billingCycles.Add(new
        {
            tenure_type = "REGULAR",
            sequence = sequence,
            total_cycles = 0,  // Legacy equivalents — NVP: TOTALBILLINGCYCLES (0 = unlimited)
            frequency = new
            {
                interval_unit = "MONTH",  // Legacy equivalents — NVP: BILLINGPERIOD
                interval_count = 1         // Legacy equivalents — NVP: BILLINGFREQUENCY
            },
            pricing_scheme = new
            {
                fixed_price = new
                {
                    value = "29.99",       // Legacy equivalents — NVP: AMT
                    currency_code = "USD"  // Legacy equivalents — NVP: CURRENCYCODE
                }
            }
        });

        // Build payment_preferences
        var paymentPreferences = new Dictionary<string, object>
        {
            { "auto_bill_outstanding", true },   // Legacy equivalents — NVP: AUTOBILLOUTAMT
            { "payment_failure_threshold", 3 }   // Legacy equivalents — NVP: MAXFAILEDPAYMENTS
        };

        // Include setup_fee for:
        // - FLOW 1 (Subscription Only): if INITAMT > 0
        // - FLOW 2 (Subscription + One-Time): map PAYMENTREQUEST_0_AMT
        // Uncomment if legacy has initial/one-time amount:
        // paymentPreferences["setup_fee"] = new { value = "49.99", currency_code = "USD" };  // Legacy equivalents — NVP: INITAMT or PAYMENTREQUEST_0_AMT

        var planRequest = new RestRequest("/v1/billing/plans", Method.Post);
        planRequest.AddHeader("Authorization", $"Bearer {accessToken}");
        planRequest.AddHeader("PayPal-Request-Id", Guid.NewGuid().ToString());
        planRequest.AddHeader("Content-Type", "application/json");
        planRequest.AddJsonBody(new
        {
            product_id = productId,
            name = "Monthly Premium Plan",  // Legacy equivalents — NVP: DESC
            billing_cycles = billingCycles,
            payment_preferences = paymentPreferences
        });

        var planResponse = client.Execute(planRequest);
        if (!planResponse.IsSuccessful)
        {
            throw new Exception($"Failed to create plan: {planResponse.Content}");
        }

        var planResult = JsonSerializer.Deserialize<JsonElement>(planResponse.Content);
        var planId = planResult.GetProperty("id").GetString();

        // Save to config file
        Directory.CreateDirectory("./config");
        var config = new { product_id = productId, plan_id = planId };
        File.WriteAllText("./config/paypal-subscriptions.json", 
            JsonSerializer.Serialize(config, new JsonSerializerOptions { WriteIndented = true }));

        Console.WriteLine($"Setup complete! Product: {productId}, Plan: {planId}");
    }
}
```

#### SNIPPET-CRPP-RUNTIME

**Per-Customer Flow (Runtime Code - After One-Time Setup)**

```csharp
// SubscriptionService.cs
using System;
using System.IO;
using System.Text.Json;
using System.Threading.Tasks;
using RestSharp;
using DotNetEnv;

public class SubscriptionService
{
    private static readonly string BaseUrl = Environment.GetEnvironmentVariable("PAYPAL_MODE") == "live"
        ? "https://api-m.paypal.com"
        : "https://api-m.sandbox.paypal.com";

    private readonly RestClient _client;
    private readonly string _planId;

    public SubscriptionService()
    {
        Env.Load();
        _client = new RestClient(BaseUrl);

        // Load config from One-Time Setup
        var configPath = "./config/paypal-subscriptions.json";
        if (!File.Exists(configPath))
        {
            throw new Exception("Run SetupSubscription first to create plan_id");
        }

        var config = JsonSerializer.Deserialize<JsonElement>(File.ReadAllText(configPath));
        _planId = config.GetProperty("plan_id").GetString();
    }

    // Include GetPayPalAccessToken() from OAuth2 snippet

    // RUNTIME FLOW:
    // 1. User clicks Subscribe → CreateSubscription() → redirect to PayPal
    // 2. User approves on PayPal → PayPal redirects to return_url
    // 3. Return handler → check status → ActivateSubscription()

    /// <summary>
    /// Create subscription and get approval URL.
    /// </summary>
    /// <param name="returnUrl">Where PayPal redirects after approval (Legacy: NVP RETURNURL)</param>
    /// <param name="cancelUrl">Where PayPal redirects if cancelled (Legacy: NVP CANCELURL)</param>
    /// <param name="customId">Your reference ID (Legacy: NVP PROFILEREFERENCE)</param>
    /// <param name="startTime">ISO 8601 start date (Legacy: NVP PROFILESTARTDATE)</param>
    public async Task<SubscriptionResult> CreateSubscriptionAsync(string returnUrl, string cancelUrl, 
        string customId = null, string startTime = null)
    {
        var accessToken = GetPayPalAccessToken();

        var subscriptionData = new Dictionary<string, object>
        {
            { "plan_id", _planId },  // From config - NOT created per customer
            { "application_context", new Dictionary<string, object>
                {
                    { "user_action", "CONTINUE" },        // CRITICAL: Requires explicit activation after approval
                    { "return_url", returnUrl },
                    { "cancel_url", cancelUrl },
                    { "brand_name", "Your Company" },     // Legacy equivalents — NVP: BRANDNAME
                    { "shipping_preference", "NO_SHIPPING" }  // Legacy equivalents — NVP: NOSHIPPING
                }
            }
        };

        if (!string.IsNullOrEmpty(customId))
            subscriptionData["custom_id"] = customId;
        if (!string.IsNullOrEmpty(startTime))
            subscriptionData["start_time"] = startTime;

        var request = new RestRequest("/v1/billing/subscriptions", Method.Post);
        request.AddHeader("Authorization", $"Bearer {accessToken}");
        request.AddHeader("PayPal-Request-Id", Guid.NewGuid().ToString());
        request.AddHeader("Content-Type", "application/json");
        request.AddJsonBody(subscriptionData);

        var response = await _client.ExecuteAsync(request);
        if (!response.IsSuccessful)
        {
            throw new Exception($"Failed to create subscription: {response.Content}");
        }

        var result = JsonSerializer.Deserialize<JsonElement>(response.Content);
        var subscriptionId = result.GetProperty("id").GetString();

        string approvalUrl = null;
        foreach (var link in result.GetProperty("links").EnumerateArray())
        {
            if (link.GetProperty("rel").GetString() == "approve")
            {
                approvalUrl = link.GetProperty("href").GetString();
                break;
            }
        }

        return new SubscriptionResult { SubscriptionId = subscriptionId, ApprovalUrl = approvalUrl };
    }

    /// <summary>
    /// Get subscription status and details.
    /// </summary>
    public async Task<JsonElement> GetSubscriptionDetailsAsync(string subscriptionId)
    {
        var accessToken = GetPayPalAccessToken();

        var request = new RestRequest($"/v1/billing/subscriptions/{subscriptionId}", Method.Get);
        request.AddHeader("Authorization", $"Bearer {accessToken}");

        var response = await _client.ExecuteAsync(request);
        if (!response.IsSuccessful)
        {
            throw new Exception($"Failed to get subscription: {response.Content}");
        }

        return JsonSerializer.Deserialize<JsonElement>(response.Content);
    }

    /// <summary>
    /// Activate subscription after user approval.
    /// CRITICAL: Only call when status is 'APPROVED' (not 'APPROVAL_PENDING').
    /// Status flow: APPROVAL_PENDING → (user approves) → APPROVED → (activate) → ACTIVE
    /// </summary>
    public async Task ActivateSubscriptionAsync(string subscriptionId)
    {
        var accessToken = GetPayPalAccessToken();

        var request = new RestRequest($"/v1/billing/subscriptions/{subscriptionId}/activate", Method.Post);
        request.AddHeader("Authorization", $"Bearer {accessToken}");
        request.AddHeader("PayPal-Request-Id", Guid.NewGuid().ToString());
        request.AddHeader("Content-Type", "application/json");
        request.AddJsonBody(new { reason = "Customer approved subscription" });

        var response = await _client.ExecuteAsync(request);
        if (!response.IsSuccessful)
        {
            throw new Exception($"Failed to activate subscription: {response.Content}");
        }
    }

    /// <summary>
    /// Handle return from PayPal approval page.
    /// Call this in your return_url route handler.
    /// </summary>
    public async Task<SubscriptionReturnResult> HandleSubscriptionReturnAsync(string subscriptionId)
    {
        var details = await GetSubscriptionDetailsAsync(subscriptionId);
        var status = details.GetProperty("status").GetString();

        if (status == "APPROVED")
        {
            await ActivateSubscriptionAsync(subscriptionId);
            return new SubscriptionReturnResult { Success = true, Status = "ACTIVE" };
        }
        else if (status == "ACTIVE")
        {
            return new SubscriptionReturnResult { Success = true, Status = "ACTIVE", Message = "Already activated" };
        }
        else
        {
            return new SubscriptionReturnResult { Success = false, Status = status, Message = $"Unexpected status: {status}" };
        }
    }

    // Helper classes
    public class SubscriptionResult
    {
        public string SubscriptionId { get; set; }
        public string ApprovalUrl { get; set; }
    }

    public class SubscriptionReturnResult
    {
        public bool Success { get; set; }
        public string Status { get; set; }
        public string Message { get; set; }
    }
}
```

#### SNIPPET-CRPP-CONFIG

**Config file structure (config/paypal-subscriptions.json)**

```json
{
  "product_id": "PROD-XXXXXXXXXXXX",
  "plan_id": "P-XXXXXXXXXXXX"
}
```

#### SNIPPET-CRPP-TRIAL-EXAMPLE

**Example: Plan with 7-day free trial then $29.99/month**

```csharp
// Legacy: TRIALBILLINGPERIOD=Day, TRIALBILLINGFREQUENCY=7, TRIALAMT=0, TRIALTOTALBILLINGCYCLES=1
//         BILLINGPERIOD=Month, BILLINGFREQUENCY=1, AMT=29.99, TOTALBILLINGCYCLES=0
var billingCycles = new List<object>
{
    new
    {
        tenure_type = "TRIAL",
        sequence = 1,
        total_cycles = 1,
        frequency = new { interval_unit = "DAY", interval_count = 7 }
        // No pricing_scheme = free trial (TRIALAMT = 0)
    },
    new
    {
        tenure_type = "REGULAR",
        sequence = 2,
        total_cycles = 0,
        frequency = new { interval_unit = "MONTH", interval_count = 1 },
        pricing_scheme = new
        {
            fixed_price = new { value = "29.99", currency_code = "USD" }
        }
    }
};
```

#### SNIPPET-CRPP-SETUP-FEE-EXAMPLE

**Example: $49.99 setup fee + $29.99/month recurring**

```csharp
// Legacy FLOW 1: INITAMT=49.99 → setup_fee
// Legacy FLOW 2: PAYMENTREQUEST_0_AMT=49.99 → setup_fee
var paymentPreferences = new Dictionary<string, object>
{
    { "auto_bill_outstanding", true },
    { "payment_failure_threshold", 3 },
    { "setup_fee", new { value = "49.99", currency_code = "USD" } }  // Legacy: NVP INITAMT or PAYMENTREQUEST_0_AMT
};

var billingCycles = new List<object>
{
    new
    {
        tenure_type = "REGULAR",
        sequence = 1,
        total_cycles = 0,
        frequency = new { interval_unit = "MONTH", interval_count = 1 },
        pricing_scheme = new
        {
            fixed_price = new { value = "29.99", currency_code = "USD" }  // Legacy: NVP AMT
        }
    }
};
```

#### SNIPPET-CRPP-TRIAL-SETUPFEE-EXAMPLE

**Example: $49.99 setup fee + 7-day free trial + $29.99/month recurring**

```csharp
// Legacy: INITAMT=49.99, TRIALBILLINGPERIOD=Day, TRIALBILLINGFREQUENCY=7, TRIALAMT=0, TRIALTOTALBILLINGCYCLES=1
//         BILLINGPERIOD=Month, BILLINGFREQUENCY=1, AMT=29.99, TOTALBILLINGCYCLES=0
// Charge sequence: setup_fee at activation → trial period → regular billing

var billingCycles = new List<object>
{
    new
    {
        tenure_type = "TRIAL",
        sequence = 1,
        total_cycles = 1,
        frequency = new { interval_unit = "DAY", interval_count = 7 }
        // No pricing_scheme = free trial (TRIALAMT = 0)
    },
    new
    {
        tenure_type = "REGULAR",
        sequence = 2,
        total_cycles = 0,
        frequency = new { interval_unit = "MONTH", interval_count = 1 },
        pricing_scheme = new
        {
            fixed_price = new { value = "29.99", currency_code = "USD" }  // Legacy: NVP AMT
        }
    }
};

var paymentPreferences = new Dictionary<string, object>
{
    { "auto_bill_outstanding", true },
    { "payment_failure_threshold", 3 },
    { "setup_fee", new { value = "49.99", currency_code = "USD" } }  // Legacy: NVP INITAMT - charged at activation, BEFORE trial starts
};
```
