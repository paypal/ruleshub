# Client Token Generation (Server-Side)

## ASP.NET Core Implementation

```csharp
[ApiController]
[Route("paypal-api")]
public class PayPalAuthController : ControllerBase
{
    private readonly IConfiguration _configuration;
    private readonly HttpClient _httpClient;
    private static string _cachedToken;
    private static DateTime _tokenExpiration;
    
    public PayPalAuthController(IConfiguration configuration, IHttpClientFactory httpClientFactory)
    {
        _configuration = configuration;
        _httpClient = httpClientFactory.CreateClient();
    }
    
    [HttpGet("auth/browser-safe-client-token")]
    public async Task<IActionResult> GetClientToken()
    {
        try
        {
            if (!string.IsNullOrEmpty(_cachedToken) && DateTime.UtcNow < _tokenExpiration)
            {
                var expiresIn = (int)(_tokenExpiration - DateTime.UtcNow).TotalSeconds;
                return Ok(new { accessToken = _cachedToken, expiresIn });
            }
            
            var clientId = _configuration["PayPal:ClientId"];
            var clientSecret = _configuration["PayPal:ClientSecret"];
            var paypalBase = _configuration["PayPal:BaseUrl"] ?? "https://api-m.sandbox.paypal.com";
            
            var auth = Convert.ToBase64String(Encoding.UTF8.GetBytes($"{clientId}:{clientSecret}"));
            
            var request = new HttpRequestMessage(HttpMethod.Post, $"{paypalBase}/v1/oauth2/token");
            request.Headers.Authorization = new AuthenticationHeaderValue("Basic", auth);
            request.Content = new StringContent(
                "grant_type=client_credentials&response_type=client_token&intent=sdk_init",
                Encoding.UTF8,
                "application/x-www-form-urlencoded"
            );
            
            var response = await _httpClient.SendAsync(request);
            response.EnsureSuccessStatusCode();
            
            var tokenData = await response.Content.ReadAsAsync<dynamic>();
            var accessToken = (string)tokenData.access_token;
            var expiresInSeconds = (int)tokenData.expires_in;
            
            _cachedToken = accessToken;
            _tokenExpiration = DateTime.UtcNow.AddSeconds(expiresInSeconds - 120);
            
            return Ok(new { accessToken, expiresIn = expiresInSeconds });
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { error = "TOKEN_GENERATION_FAILED", message = "Failed to generate client token" });
        }
    }
    
    private async Task<string> GetAccessToken()
    {
        var clientId = _configuration["PayPal:ClientId"];
        var clientSecret = _configuration["PayPal:ClientSecret"];
        var paypalBase = _configuration["PayPal:BaseUrl"] ?? "https://api-m.sandbox.paypal.com";
        
        var auth = Convert.ToBase64String(Encoding.UTF8.GetBytes($"{clientId}:{clientSecret}"));
        
        var request = new HttpRequestMessage(HttpMethod.Post, $"{paypalBase}/v1/oauth2/token");
        request.Headers.Authorization = new AuthenticationHeaderValue("Basic", auth);
        request.Content = new StringContent(
            "grant_type=client_credentials",
            Encoding.UTF8,
            "application/x-www-form-urlencoded"
        );
        
        var response = await _httpClient.SendAsync(request);
        response.EnsureSuccessStatusCode();
        
        var tokenData = await response.Content.ReadAsAsync<dynamic>();
        return (string)tokenData.access_token;
    }
}
```

## Configuration (appsettings.json)

```json
{
  "PayPal": {
    "ClientId": "your_client_id_here",
    "ClientSecret": "your_client_secret_here",
    "BaseUrl": "https://api-m.sandbox.paypal.com"
  }
}
```

