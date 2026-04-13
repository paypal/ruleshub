# Save Payment Button (Server-Side)

## ASP.NET Core Implementation

```csharp
[ApiController]
[Route("paypal-api/vault")]
public class PayPalSavePaymentController : ControllerBase
{
    private readonly IConfiguration _configuration;
    private readonly HttpClient _httpClient;
    
    public PayPalSavePaymentController(IConfiguration configuration, IHttpClientFactory httpClientFactory)
    {
        _configuration = configuration;
        _httpClient = httpClientFactory.CreateClient();
    }
    
    [HttpPost("setup-tokens/create")]
    public async Task<IActionResult> CreateSetupTokenForSave([FromBody] dynamic request)
    {
        try
        {
            var accessToken = await GetAccessToken();
            var paypalBase = _configuration["PayPal:BaseUrl"] ?? "https://api-m.sandbox.paypal.com";
            
            var paymentMethod = (string)(request.payment_method ?? "paypal");
            object payload;
            
            if (paymentMethod == "paypal")
            {
                payload = new
                {
                    payment_source = new
                    {
                        paypal = new
                        {
                            usage_type = "MERCHANT",
                            customer_type = "CONSUMER",
                            permit_multiple_payment_tokens = true
                        }
                    }
                };
            }
            else if (paymentMethod == "card")
            {
                payload = new
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
                            verification_method = "SCA_WHEN_REQUIRED"
                        }
                    }
                };
            }
            else
            {
                return BadRequest(new { error = "INVALID_PAYMENT_METHOD", message = "Payment method must be paypal or card" });
            }
            
            var httpRequest = new HttpRequestMessage(HttpMethod.Post, $"{paypalBase}/v3/vault/setup-tokens");
            httpRequest.Headers.Authorization = new AuthenticationHeaderValue("Bearer", accessToken);
            httpRequest.Headers.Add("PayPal-Request-Id", Guid.NewGuid().ToString());
            httpRequest.Content = new StringContent(
                JsonConvert.SerializeObject(payload),
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
            return StatusCode(500, new { error = "SETUP_TOKEN_FAILED" });
        }
    }
    
    [HttpPost("payment-tokens/create")]
    public async Task<IActionResult> CreatePaymentTokenFromSetup([FromBody] dynamic request)
    {
        try
        {
            var setupToken = (string)request.vaultSetupToken;
            
            if (string.IsNullOrEmpty(setupToken))
            {
                return BadRequest(new { error = "MISSING_SETUP_TOKEN", message = "vaultSetupToken is required" });
            }
            
            var accessToken = await GetAccessToken();
            var paypalBase = _configuration["PayPal:BaseUrl"] ?? "https://api-m.sandbox.paypal.com";
            
            var payload = new
            {
                payment_source = new
                {
                    token = new
                    {
                        id = setupToken,
                        type = "SETUP_TOKEN"
                    }
                }
            };
            
            var httpRequest = new HttpRequestMessage(HttpMethod.Post, $"{paypalBase}/v3/vault/payment-tokens");
            httpRequest.Headers.Authorization = new AuthenticationHeaderValue("Bearer", accessToken);
            httpRequest.Headers.Add("PayPal-Request-Id", Guid.NewGuid().ToString());
            httpRequest.Content = new StringContent(
                JsonConvert.SerializeObject(payload),
                Encoding.UTF8,
                "application/json"
            );
            
            var response = await _httpClient.SendAsync(httpRequest);
            var tokenData = await response.Content.ReadAsAsync<dynamic>();
            
            if (!response.IsSuccessStatusCode)
            {
                return StatusCode((int)response.StatusCode, tokenData);
            }
            
            return Ok(new
            {
                id = (string)tokenData.id,
                customerId = (string)tokenData.customer?.id,
                status = "saved"
            });
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { error = "PAYMENT_TOKEN_FAILED" });
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

