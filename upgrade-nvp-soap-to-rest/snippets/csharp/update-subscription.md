#### SNIPPET-URPP

**Update Subscription (replaces UpdateRecurringPaymentsProfile)**

> REST equivalent: `PATCH /v1/billing/subscriptions/{subscription_id}`

```csharp
using System;
using System.Collections.Generic;
using System.Net.Http;
using System.Net.Http.Headers;
using System.Text;
using System.Threading.Tasks;
using Newtonsoft.Json;

/// <summary>
/// Update subscription
/// Legacy equivalents — NVP: UpdateRecurringPaymentsProfile; SOAP: UpdateRecurringPaymentsProfile
/// </summary>
/// <param name="subscriptionId">REST subscription ID (starts with I-). Legacy equivalents — NVP: PROFILEID; SOAP: ProfileID</param>
/// <param name="patchOperations">JSON Patch operations array</param>
/// <returns>Updated subscription</returns>
public static async Task<dynamic> UpdateSubscriptionAsync(string subscriptionId, List<object> patchOperations)
{
    try
    {
        var accessToken = await GetAccessTokenAsync();
        
        var request = new HttpRequestMessage(new HttpMethod("PATCH"), $"{BaseUrl}/v1/billing/subscriptions/{subscriptionId}")
        {
            Content = new StringContent(JsonConvert.SerializeObject(patchOperations), Encoding.UTF8, "application/json")
        };
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", accessToken);
        request.Headers.Add("PayPal-Request-Id", Guid.NewGuid().ToString());
        
        var response = await HttpClient.SendAsync(request);
        var responseBody = await response.Content.ReadAsStringAsync();
        
        if (!response.IsSuccessStatusCode)
        {
            var errorResponse = JsonConvert.DeserializeObject<dynamic>(responseBody);
            var debugId = errorResponse?.debug_id?.ToString();
            Console.WriteLine($"Error debug id: {debugId}");
            throw new HttpRequestException($"Request failed with status code {response.StatusCode}");
        }
        
        return JsonConvert.DeserializeObject<dynamic>(responseBody);
    }
    catch (Exception e)
    {
        Console.WriteLine($"Error: {e.Message}");
        throw;
    }
}
```

**Update billing amount (20% limit applies)**

```csharp
/// <summary>
/// Update subscription billing amount
/// Legacy equivalents — NVP: AMT; SOAP: PaymentPeriod.Amount
/// Note: Can only increase by 20% maximum per 180-day interval
/// Note: Cannot update within 3 days of scheduled billing date
/// </summary>
public static async Task<dynamic> UpdateBillingAmountAsync(string subscriptionId, string amount, string currencyCode = "USD")
{
    var patchOperations = new List<object>
    {
        new
        {
            op = "replace",
            path = "/plan/billing_cycles/@sequence==1/pricing_scheme/fixed_price",
            value = new
            {
                currency_code = currencyCode, // Legacy equivalents — NVP: CURRENCYCODE; SOAP: Amount.currencyID
                value = amount                 // Legacy equivalents — NVP: AMT; SOAP: PaymentPeriod.Amount
            }
        }
    };
    
    return await UpdateSubscriptionAsync(subscriptionId, patchOperations);
}
```

**Update shipping amount**

```csharp
/// <summary>
/// Update subscription shipping amount
/// Legacy equivalents — NVP: SHIPPINGAMT; SOAP: PaymentPeriod.ShippingAmount
/// </summary>
public static async Task<dynamic> UpdateShippingAmountAsync(string subscriptionId, string amount, string currencyCode = "USD")
{
    var patchOperations = new List<object>
    {
        new
        {
            op = "replace",
            path = "/shipping_amount",
            value = new
            {
                currency_code = currencyCode,
                value = amount  // Legacy equivalents — NVP: SHIPPINGAMT; SOAP: PaymentPeriod.ShippingAmount
            }
        }
    };
    
    return await UpdateSubscriptionAsync(subscriptionId, patchOperations);
}
```
