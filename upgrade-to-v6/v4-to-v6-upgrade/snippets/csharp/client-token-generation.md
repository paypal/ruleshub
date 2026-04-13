#### Generate Client Token for v6 SDK

```csharp
using Microsoft.AspNetCore.Mvc;
using System.Net.Http;
using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;

[ApiController]
[Route("paypal-api")]
public class PayPalTokenController : ControllerBase
{
    private readonly string _paypalBase = Environment.GetEnvironmentVariable("PAYPAL_BASE") ?? "https://api-m.sandbox.paypal.com";
    private readonly string _clientId = Environment.GetEnvironmentVariable("PAYPAL_CLIENT_ID");
    private readonly string _clientSecret = Environment.GetEnvironmentVariable("PAYPAL_CLIENT_SECRET");
    private readonly HttpClient _httpClient;

    public PayPalTokenController(IHttpClientFactory httpClientFactory)
    {
        _httpClient = httpClientFactory.CreateClient();
    }

    [HttpGet("auth/browser-safe-client-token")]
    public async Task<IActionResult> GetBrowserSafeClientToken()
    {
        try
        {
            var auth = Convert.ToBase64String(Encoding.UTF8.GetBytes($"{_clientId}:{_clientSecret}"));
            
            var request = new HttpRequestMessage(HttpMethod.Post, $"{_paypalBase}/v1/oauth2/token");
            request.Headers.Authorization = new AuthenticationHeaderValue("Basic", auth);
            request.Content = new StringContent(
                "grant_type=client_credentials&response_type=client_token&intent=sdk_init",
                Encoding.UTF8,
                "application/x-www-form-urlencoded"
            );
            
            var response = await _httpClient.SendAsync(request);
            var content = await response.Content.ReadAsStringAsync();
            var tokenData = JsonSerializer.Deserialize<JsonElement>(content);
            
            return Ok(new
            {
                accessToken = tokenData.GetProperty("access_token").GetString(),
                expiresIn = tokenData.GetProperty("expires_in").GetInt32()
            });
        }
        catch
        {
            return StatusCode(500, new { error = "TOKEN_GENERATION_FAILED" });
        }
    }

    public async Task<string> GetAccessToken()
    {
        var auth = Convert.ToBase64String(Encoding.UTF8.GetBytes($"{_clientId}:{_clientSecret}"));
        
        var request = new HttpRequestMessage(HttpMethod.Post, $"{_paypalBase}/v1/oauth2/token");
        request.Headers.Authorization = new AuthenticationHeaderValue("Basic", auth);
        request.Content = new StringContent(
            "grant_type=client_credentials",
            Encoding.UTF8,
            "application/x-www-form-urlencoded"
        );
        
        var response = await _httpClient.SendAsync(request);
        var content = await response.Content.ReadAsStringAsync();
        var tokenData = JsonSerializer.Deserialize<JsonElement>(content);
        
        return tokenData.GetProperty("access_token").GetString();
    }
}
```

