#### Void Authorization

```csharp
using Microsoft.AspNetCore.Mvc;
using System.Net.Http;
using System.Net.Http.Headers;
using System.Text;

[HttpPost("payments/authorizations/{authorizationId}/void")]
public async Task<IActionResult> VoidAuthorization(string authorizationId)
{
    try
    {
        var accessToken = await _tokenController.GetAccessToken();
        
        var request = new HttpRequestMessage(HttpMethod.Post, 
            $"{_paypalBase}/v2/payments/authorizations/{authorizationId}/void");
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", accessToken);
        request.Headers.Add("PayPal-Request-Id", Guid.NewGuid().ToString());
        request.Content = new StringContent("{}", Encoding.UTF8, "application/json");
        
        var response = await _httpClient.SendAsync(request);
        
        return Ok(new
        {
            success = true,
            authorizationId,
            status = "VOIDED"
        });
    }
    catch
    {
        return StatusCode(500, new { error = "VOID_FAILED" });
    }
}
```

