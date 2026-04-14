# 3D Secure Integration (Server-Side)

## ASP.NET Core Implementation

```csharp
[ApiController]
[Route("paypal-api/checkout/orders")]
public class PayPal3DSController : ControllerBase
{
    private readonly IConfiguration _configuration;
    private readonly HttpClient _httpClient;
    
    public PayPal3DSController(IConfiguration configuration, IHttpClientFactory httpClientFactory)
    {
        _configuration = configuration;
        _httpClient = httpClientFactory.CreateClient();
    }
    
    [HttpPost("create-3ds")]
    public async Task<IActionResult> CreateOrderWith3DS([FromBody] dynamic request)
    {
        try
        {
            var accessToken = await GetAccessToken();
            var paypalBase = _configuration["PayPal:BaseUrl"] ?? "https://api-m.sandbox.paypal.com";
            
            var amount = (string)request.amount;
            var currency = (string)(request.currency ?? "USD");
            var scaMethod = (string)(request.scaMethod ?? "SCA_ALWAYS");
            
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
                    card = new
                    {
                        attributes = new
                        {
                            verification = new { method = scaMethod }
                        },
                        experience_context = new
                        {
                            return_url = (string)(request.return_url ?? "https://example.com/returnUrl"),
                            cancel_url = (string)(request.cancel_url ?? "https://example.com/cancelUrl")
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
    
    [HttpPost("{orderId}/capture-3ds")]
    public async Task<IActionResult> CaptureOrderWith3DSLogging(string orderId)
    {
        try
        {
            var accessToken = await GetAccessToken();
            var paypalBase = _configuration["PayPal:BaseUrl"] ?? "https://api-m.sandbox.paypal.com";
            
            var request = new HttpRequestMessage(HttpMethod.Post, $"{paypalBase}/v2/checkout/orders/{orderId}/capture");
            request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", accessToken);
            request.Headers.Add("PayPal-Request-Id", Guid.NewGuid().ToString());
            request.Content = new StringContent("{}", Encoding.UTF8, "application/json");
            
            var response = await _httpClient.SendAsync(request);
            var captureData = await response.Content.ReadAsAsync<dynamic>();
            
            if (response.IsSuccessStatusCode)
            {
                var authResult = captureData.payment_source?.card?.authentication_result;
                
                if (authResult != null)
                {
                    var threeDS = authResult.three_d_secure;
                    
                    Console.WriteLine("3DS Authentication Result:");
                    Console.WriteLine($"  Order ID: {captureData.id}");
                    Console.WriteLine($"  Liability Shift: {authResult.liability_shift}");
                    Console.WriteLine($"  Auth Status: {threeDS?.authentication_status}");
                    Console.WriteLine($"  Enrollment Status: {threeDS?.enrollment_status}");
                }
            }
            
            return StatusCode((int)response.StatusCode, captureData);
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { error = "CAPTURE_FAILED" });
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

