# Venmo Integration (Server-Side)

## ASP.NET Core Implementation

```csharp
[ApiController]
[Route("paypal-api/checkout/orders")]
public class PayPalVenmoController : ControllerBase
{
    private readonly IConfiguration _configuration;
    private readonly HttpClient _httpClient;
    
    public PayPalVenmoController(IConfiguration configuration, IHttpClientFactory httpClientFactory)
    {
        _configuration = configuration;
        _httpClient = httpClientFactory.CreateClient();
    }
    
    [HttpPost("create-venmo")]
    public async Task<IActionResult> CreateOrderForVenmo([FromBody] dynamic request)
    {
        try
        {
            var accessToken = await GetAccessToken();
            var paypalBase = _configuration["PayPal:BaseUrl"] ?? "https://api-m.sandbox.paypal.com";
            
            var amount = (string)request.amount;
            var currency = (string)(request.currency ?? "USD");
            
            var orderPayload = new
            {
                intent = "CAPTURE",
                purchase_units = new[]
                {
                    new
                    {
                        amount = new
                        {
                            currency_code = currency,
                            value = decimal.Parse(amount).ToString("F2")
                        }
                    }
                },
                payment_source = new
                {
                    venmo = new
                    {
                        experience_context = new
                        {
                            payment_method_preference = "IMMEDIATE_PAYMENT_REQUIRED",
                            brand_name = (string)(request.brand_name ?? "Your Store"),
                            shipping_preference = "NO_SHIPPING",
                            user_action = "PAY_NOW"
                        }
                    }
                }
            };
            
            var httpRequest = new HttpRequestMessage(HttpMethod.Post, $"{paypalBase}/v2/checkout/orders");
            httpRequest.Headers.Authorization = new AuthenticationHeaderValue("Bearer", accessToken);
            httpRequest.Headers.Add("PayPal-Request-Id", Guid.NewGuid().ToString());
            httpRequest.Content = new StringContent(
                JsonConvert.SerializeObject(orderPayload),
                Encoding.UTF8,
                "application/json"
            );
            
            var response = await _httpClient.SendAsync(httpRequest);
            var orderData = await response.Content.ReadAsAsync<dynamic>();
            
            return StatusCode((int)response.StatusCode, orderData);
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { error = "ORDER_CREATION_FAILED" });
        }
    }
    
    [HttpPost("create-with-saved-venmo")]
    public async Task<IActionResult> CreateOrderWithSavedVenmo([FromBody] dynamic request)
    {
        try
        {
            var vaultId = (string)request.vaultId;
            
            if (string.IsNullOrEmpty(vaultId))
            {
                return BadRequest(new { error = "MISSING_VAULT_ID", message = "vaultId is required" });
            }
            
            var accessToken = await GetAccessToken();
            var paypalBase = _configuration["PayPal:BaseUrl"] ?? "https://api-m.sandbox.paypal.com";
            
            var amount = (string)request.amount;
            var currency = (string)(request.currency ?? "USD");
            
            var orderPayload = new
            {
                intent = "CAPTURE",
                purchase_units = new[]
                {
                    new
                    {
                        amount = new
                        {
                            currency_code = currency,
                            value = decimal.Parse(amount).ToString("F2")
                        }
                    }
                },
                payment_source = new
                {
                    venmo = new { vault_id = vaultId }
                }
            };
            
            var orderRequest = new HttpRequestMessage(HttpMethod.Post, $"{paypalBase}/v2/checkout/orders");
            orderRequest.Headers.Authorization = new AuthenticationHeaderValue("Bearer", accessToken);
            orderRequest.Headers.Add("PayPal-Request-Id", Guid.NewGuid().ToString());
            orderRequest.Content = new StringContent(
                JsonConvert.SerializeObject(orderPayload),
                Encoding.UTF8,
                "application/json"
            );
            
            var orderResponse = await _httpClient.SendAsync(orderRequest);
            var orderData = await orderResponse.Content.ReadAsAsync<dynamic>();
            
            if ((string)orderData.status == "CREATED")
            {
                var orderId = (string)orderData.id;
                
                var captureRequest = new HttpRequestMessage(HttpMethod.Post, $"{paypalBase}/v2/checkout/orders/{orderId}/capture");
                captureRequest.Headers.Authorization = new AuthenticationHeaderValue("Bearer", accessToken);
                captureRequest.Headers.Add("PayPal-Request-Id", Guid.NewGuid().ToString());
                captureRequest.Content = new StringContent("{}", Encoding.UTF8, "application/json");
                
                var captureResponse = await _httpClient.SendAsync(captureRequest);
                var captureData = await captureResponse.Content.ReadAsAsync<dynamic>();
                
                return Ok(captureData);
            }
            
            return Ok(orderData);
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { error = "PAYMENT_FAILED" });
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

