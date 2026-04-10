#### SNIPPET-GRPPD

**Get Subscription Details (replaces GetRecurringPaymentsProfileDetails)**

> REST equivalent: `GET /v1/billing/subscriptions/{subscription_id}`

```csharp
using System;
using System.Net.Http;
using System.Net.Http.Headers;
using System.Threading.Tasks;
using Newtonsoft.Json;

/// <summary>
/// Get subscription details
/// Legacy equivalents — NVP: GetRecurringPaymentsProfileDetails; SOAP: GetRecurringPaymentsProfileDetails
/// </summary>
/// <param name="subscriptionId">REST subscription ID (starts with I-). Legacy equivalents — NVP: PROFILEID; SOAP: ProfileID</param>
/// <returns>Subscription details including status, billing_info, subscriber</returns>
public static async Task<dynamic> GetSubscriptionDetailsAsync(string subscriptionId)
{
    try
    {
        var accessToken = await GetAccessTokenAsync();
        
        var request = new HttpRequestMessage(HttpMethod.Get, $"{BaseUrl}/v1/billing/subscriptions/{subscriptionId}");
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", accessToken);
        request.Headers.Add("PayPal-Request-Id", Guid.NewGuid().ToString());
        request.Headers.Accept.Add(new MediaTypeWithQualityHeaderValue("application/json"));
        
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

**Get Plan Details (optional - if full billing cycle config needed)**

> Call this if subscription response doesn't include full billing cycle configuration

```csharp
/// <summary>
/// Get plan details
/// </summary>
/// <param name="planId">Plan ID from subscription.plan_id</param>
public static async Task<dynamic> GetPlanDetailsAsync(string planId)
{
    try
    {
        var accessToken = await GetAccessTokenAsync();
        
        var request = new HttpRequestMessage(HttpMethod.Get, $"{BaseUrl}/v1/billing/plans/{planId}");
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", accessToken);
        request.Headers.Add("PayPal-Request-Id", Guid.NewGuid().ToString());
        request.Headers.Accept.Add(new MediaTypeWithQualityHeaderValue("application/json"));
        
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
