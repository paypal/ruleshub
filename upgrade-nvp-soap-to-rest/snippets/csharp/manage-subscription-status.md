#### SNIPPET-MRPPS

**Manage Subscription Status (replaces ManageRecurringPaymentsProfileStatus)**

> REST has three separate endpoints based on action:
> - Suspend: `POST /v1/billing/subscriptions/{id}/suspend`
> - Cancel: `POST /v1/billing/subscriptions/{id}/cancel`
> - Reactivate: `POST /v1/billing/subscriptions/{id}/activate`

**Suspend Subscription**

```csharp
using System;
using System.Net.Http;
using System.Net.Http.Headers;
using System.Text;
using System.Threading.Tasks;
using Newtonsoft.Json;

/// <summary>
/// Suspend subscription (temporarily pause billing)
/// Legacy equivalents — NVP: ManageRecurringPaymentsProfileStatus with ACTION=Suspend
/// </summary>
/// <param name="subscriptionId">REST subscription ID (starts with I-). Legacy equivalents — NVP: PROFILEID; SOAP: ProfileID</param>
/// <param name="reason">Reason for suspension (required in REST). Legacy equivalents — NVP: NOTE; SOAP: Note</param>
public static async Task SuspendSubscriptionAsync(string subscriptionId, string reason)
{
    try
    {
        var accessToken = await GetAccessTokenAsync();
        var payload = new { reason };
        
        var request = new HttpRequestMessage(HttpMethod.Post, $"{BaseUrl}/v1/billing/subscriptions/{subscriptionId}/suspend")
        {
            Content = new StringContent(JsonConvert.SerializeObject(payload), Encoding.UTF8, "application/json")
        };
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", accessToken);
        request.Headers.Add("PayPal-Request-Id", Guid.NewGuid().ToString());
        
        var response = await HttpClient.SendAsync(request);
        
        if (!response.IsSuccessStatusCode)
        {
            var responseBody = await response.Content.ReadAsStringAsync();
            var errorResponse = JsonConvert.DeserializeObject<dynamic>(responseBody);
            var debugId = errorResponse?.debug_id?.ToString();
            Console.WriteLine($"Error debug id: {debugId}");
            throw new HttpRequestException($"Request failed with status code {response.StatusCode}");
        }
        
        Console.WriteLine("Subscription suspended");
    }
    catch (Exception e)
    {
        Console.WriteLine($"Error: {e.Message}");
        throw;
    }
}
```

**Cancel Subscription**

```csharp
/// <summary>
/// Cancel subscription (permanently end - cannot be undone)
/// Legacy equivalents — NVP: ManageRecurringPaymentsProfileStatus with ACTION=Cancel
/// </summary>
/// <param name="subscriptionId">REST subscription ID. Legacy equivalents — NVP: PROFILEID; SOAP: ProfileID</param>
/// <param name="reason">Reason for cancellation (required in REST). Legacy equivalents — NVP: NOTE; SOAP: Note</param>
public static async Task CancelSubscriptionAsync(string subscriptionId, string reason)
{
    try
    {
        var accessToken = await GetAccessTokenAsync();
        var payload = new { reason };
        
        var request = new HttpRequestMessage(HttpMethod.Post, $"{BaseUrl}/v1/billing/subscriptions/{subscriptionId}/cancel")
        {
            Content = new StringContent(JsonConvert.SerializeObject(payload), Encoding.UTF8, "application/json")
        };
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", accessToken);
        request.Headers.Add("PayPal-Request-Id", Guid.NewGuid().ToString());
        
        var response = await HttpClient.SendAsync(request);
        
        if (!response.IsSuccessStatusCode)
        {
            var responseBody = await response.Content.ReadAsStringAsync();
            var errorResponse = JsonConvert.DeserializeObject<dynamic>(responseBody);
            var debugId = errorResponse?.debug_id?.ToString();
            Console.WriteLine($"Error debug id: {debugId}");
            throw new HttpRequestException($"Request failed with status code {response.StatusCode}");
        }
        
        Console.WriteLine("Subscription cancelled");
    }
    catch (Exception e)
    {
        Console.WriteLine($"Error: {e.Message}");
        throw;
    }
}
```

**Reactivate Subscription**

```csharp
/// <summary>
/// Reactivate subscription (resume from suspended state)
/// Legacy equivalents — NVP: ManageRecurringPaymentsProfileStatus with ACTION=Reactivate
/// Note: This is the same endpoint used for initial activation after buyer approval
/// </summary>
/// <param name="subscriptionId">REST subscription ID. Legacy equivalents — NVP: PROFILEID; SOAP: ProfileID</param>
/// <param name="reason">Reason for reactivation. Legacy equivalents — NVP: NOTE; SOAP: Note</param>
public static async Task ReactivateSubscriptionAsync(string subscriptionId, string reason)
{
    try
    {
        var accessToken = await GetAccessTokenAsync();
        var payload = new { reason };
        
        var request = new HttpRequestMessage(HttpMethod.Post, $"{BaseUrl}/v1/billing/subscriptions/{subscriptionId}/activate")
        {
            Content = new StringContent(JsonConvert.SerializeObject(payload), Encoding.UTF8, "application/json")
        };
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", accessToken);
        request.Headers.Add("PayPal-Request-Id", Guid.NewGuid().ToString());
        
        var response = await HttpClient.SendAsync(request);
        
        if (!response.IsSuccessStatusCode)
        {
            var responseBody = await response.Content.ReadAsStringAsync();
            var errorResponse = JsonConvert.DeserializeObject<dynamic>(responseBody);
            var debugId = errorResponse?.debug_id?.ToString();
            Console.WriteLine($"Error debug id: {debugId}");
            throw new HttpRequestException($"Request failed with status code {response.StatusCode}");
        }
        
        Console.WriteLine("Subscription reactivated");
    }
    catch (Exception e)
    {
        Console.WriteLine($"Error: {e.Message}");
        throw;
    }
}
```
