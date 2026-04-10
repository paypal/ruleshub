#### Capture Order

```csharp
using Microsoft.AspNetCore.Mvc;
using System.Net.Http;
using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;

[HttpPost("{orderId}/capture")]
public async Task<IActionResult> CaptureOrder(string orderId)
{
    try
    {
        var accessToken = await _tokenController.GetAccessToken();
        
        var request = new HttpRequestMessage(HttpMethod.Post, $"{_paypalBase}/v2/checkout/orders/{orderId}/capture");
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", accessToken);
        request.Headers.Add("PayPal-Request-Id", Guid.NewGuid().ToString());
        request.Content = new StringContent("{}", Encoding.UTF8, "application/json");
        
        var response = await _httpClient.SendAsync(request);
        var content = await response.Content.ReadAsStringAsync();
        
        return StatusCode((int)response.StatusCode, JsonSerializer.Deserialize<object>(content));
    }
    catch
    {
        return StatusCode(500, new { error = "CAPTURE_FAILED" });
    }
}
```

