# Create Setup Token (Server-Side)

## ASP.NET Core Implementation

```csharp
[ApiController]
[Route("paypal-api/vault")]
public class PayPalSetupTokenController : ControllerBase
{
    private readonly IConfiguration _configuration;
    private readonly HttpClient _httpClient;
    
    public PayPalSetupTokenController(IConfiguration configuration, IHttpClientFactory httpClientFactory)
    {
        _configuration = configuration;
        _httpClient = httpClientFactory.CreateClient();
    }
    
    [HttpPost("setup-tokens")]
    public async Task<IActionResult> CreateSetupToken([FromBody] dynamic request)
    {
        try
        {
            var accessToken = await GetAccessToken();
            var paypalBase = _configuration["PayPal:BaseUrl"] ?? "https://api-m.sandbox.paypal.com";
            
            var paymentMethod = (string)(request.payment_method ?? "paypal");
            object setupTokenPayload;
            
            if (paymentMethod == "paypal")
            {
                setupTokenPayload = new
                {
                    payment_source = new
                    {
                        paypal = new
                        {
                            usage_type = (string)(request.usage_type ?? "MERCHANT"),
                            customer_type = (string)(request.customer_type ?? "CONSUMER"),
                            permit_multiple_payment_tokens = (bool)(request.permit_multiple_payment_tokens ?? true)
                        }
                    }
                };
            }
            else
            {
                setupTokenPayload = new
                {
                    payment_source = new
                    {
                        card = new
                        {
                            experience_context = new
                            {
                                return_url = (string)(request.return_url ?? "https://example.com/returnUrl"),
                                cancel_url = (string)(request.cancel_url ?? "https://example.com/cancelUrl")
                            },
                            verification_method = (string)(request.verification_method ?? "SCA_WHEN_REQUIRED")
                        }
                    }
                };
            }
            
            var httpRequest = new HttpRequestMessage(HttpMethod.Post, $"{paypalBase}/v3/vault/setup-tokens");
            httpRequest.Headers.Authorization = new AuthenticationHeaderValue("Bearer", accessToken);
            httpRequest.Headers.Add("PayPal-Request-Id", Guid.NewGuid().ToString());
            httpRequest.Content = new StringContent(
                JsonConvert.SerializeObject(setupTokenPayload),
                Encoding.UTF8,
                "application/json"
            );
            
            var response = await _httpClient.SendAsync(httpRequest);
            var setupData = await response.Content.ReadAsAsync<dynamic>();
            
            if (!response.IsSuccessStatusCode)
            {
                return StatusCode((int)response.StatusCode, setupData);
            }
            
            return Ok(new
            {
                id = (string)setupData.id,
                status = (string)setupData.status
            });
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { error = "SETUP_TOKEN_FAILED", message = "Failed to create setup token" });
        }
    }
    
    [HttpGet("setup-tokens/{tokenId}")]
    public async Task<IActionResult> GetSetupToken(string tokenId)
    {
        try
        {
            var accessToken = await GetAccessToken();
            var paypalBase = _configuration["PayPal:BaseUrl"] ?? "https://api-m.sandbox.paypal.com";
            
            var request = new HttpRequestMessage(HttpMethod.Get, $"{paypalBase}/v3/vault/setup-tokens/{tokenId}");
            request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", accessToken);
            
            var response = await _httpClient.SendAsync(request);
            
            if (!response.IsSuccessStatusCode)
            {
                return NotFound(new { error = "SETUP_TOKEN_NOT_FOUND" });
            }
            
            var setupData = await response.Content.ReadAsAsync<dynamic>();
            return Ok(setupData);
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { error = "FETCH_FAILED" });
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

