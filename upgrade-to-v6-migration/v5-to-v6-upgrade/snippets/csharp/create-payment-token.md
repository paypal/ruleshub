# Create Payment Token (Server-Side)

## ASP.NET Core Implementation

```csharp
[ApiController]
[Route("paypal-api/vault")]
public class PayPalPaymentTokenController : ControllerBase
{
    private readonly IConfiguration _configuration;
    private readonly HttpClient _httpClient;
    
    public PayPalPaymentTokenController(IConfiguration configuration, IHttpClientFactory httpClientFactory)
    {
        _configuration = configuration;
        _httpClient = httpClientFactory.CreateClient();
    }
    
    [HttpPost("payment-tokens")]
    public async Task<IActionResult> CreatePaymentToken([FromBody] dynamic request)
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
            return StatusCode(500, new { error = "PAYMENT_TOKEN_FAILED", message = "Failed to create payment token" });
        }
    }
    
    [HttpGet("payment-tokens")]
    public async Task<IActionResult> ListPaymentTokens([FromQuery] string customer_id)
    {
        try
        {
            if (string.IsNullOrEmpty(customer_id))
            {
                return BadRequest(new { error = "MISSING_CUSTOMER_ID", message = "customer_id query parameter is required" });
            }
            
            var accessToken = await GetAccessToken();
            var paypalBase = _configuration["PayPal:BaseUrl"] ?? "https://api-m.sandbox.paypal.com";
            
            var request = new HttpRequestMessage(HttpMethod.Get, $"{paypalBase}/v3/vault/payment-tokens?customer_id={customer_id}");
            request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", accessToken);
            
            var response = await _httpClient.SendAsync(request);
            
            if (!response.IsSuccessStatusCode)
            {
                return StatusCode((int)response.StatusCode, new { error = "FETCH_FAILED" });
            }
            
            var tokensData = await response.Content.ReadAsAsync<dynamic>();
            var paymentTokens = tokensData.payment_tokens ?? new object[0];
            
            return Ok(new
            {
                payment_tokens = paymentTokens,
                total_items = paymentTokens.Length
            });
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { error = "FETCH_FAILED" });
        }
    }
    
    [HttpGet("payment-tokens/{tokenId}")]
    public async Task<IActionResult> GetPaymentToken(string tokenId)
    {
        try
        {
            var accessToken = await GetAccessToken();
            var paypalBase = _configuration["PayPal:BaseUrl"] ?? "https://api-m.sandbox.paypal.com";
            
            var request = new HttpRequestMessage(HttpMethod.Get, $"{paypalBase}/v3/vault/payment-tokens/{tokenId}");
            request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", accessToken);
            
            var response = await _httpClient.SendAsync(request);
            
            if (!response.IsSuccessStatusCode)
            {
                return NotFound(new { error = "TOKEN_NOT_FOUND" });
            }
            
            var tokenData = await response.Content.ReadAsAsync<dynamic>();
            return Ok(tokenData);
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { error = "FETCH_FAILED" });
        }
    }
    
    [HttpDelete("payment-tokens/{tokenId}")]
    public async Task<IActionResult> DeletePaymentToken(string tokenId)
    {
        try
        {
            var accessToken = await GetAccessToken();
            var paypalBase = _configuration["PayPal:BaseUrl"] ?? "https://api-m.sandbox.paypal.com";
            
            var request = new HttpRequestMessage(HttpMethod.Delete, $"{paypalBase}/v3/vault/payment-tokens/{tokenId}");
            request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", accessToken);
            
            var response = await _httpClient.SendAsync(request);
            
            if (response.StatusCode == System.Net.HttpStatusCode.NoContent)
            {
                return Ok(new { success = true, message = "Payment token deleted successfully" });
            }
            
            return StatusCode((int)response.StatusCode, new { success = false });
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { error = "DELETE_FAILED" });
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

