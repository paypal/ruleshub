# Capture Order (Server-Side)

## ASP.NET Core Implementation

```csharp
[ApiController]
[Route("paypal-api/checkout/orders")]
public class PayPalCaptureController : ControllerBase
{
    private readonly IConfiguration _configuration;
    private readonly HttpClient _httpClient;
    
    public PayPalCaptureController(IConfiguration configuration, IHttpClientFactory httpClientFactory)
    {
        _configuration = configuration;
        _httpClient = httpClientFactory.CreateClient();
    }
    
    [HttpPost("{orderId}/capture")]
    public async Task<IActionResult> CaptureOrder(string orderId)
    {
        try
        {
            if (string.IsNullOrEmpty(orderId))
            {
                return BadRequest(new { error = "INVALID_ORDER_ID", message = "Order ID is required" });
            }
            
            var accessToken = await GetAccessToken();
            var paypalBase = _configuration["PayPal:BaseUrl"] ?? "https://api-m.sandbox.paypal.com";
            
            var getRequest = new HttpRequestMessage(HttpMethod.Get, $"{paypalBase}/v2/checkout/orders/{orderId}");
            getRequest.Headers.Authorization = new AuthenticationHeaderValue("Bearer", accessToken);
            
            var orderResponse = await _httpClient.SendAsync(getRequest);
            
            if (!orderResponse.IsSuccessStatusCode)
            {
                return NotFound(new { error = "ORDER_NOT_FOUND", message = "Order not found" });
            }
            
            var orderData = await orderResponse.Content.ReadAsAsync<dynamic>();
            var status = (string)orderData.status;
            
            if (status != "APPROVED")
            {
                return BadRequest(new
                {
                    error = "ORDER_NOT_APPROVED",
                    message = $"Order status is {status}, not APPROVED",
                    orderId
                });
            }
            
            var captureRequest = new HttpRequestMessage(HttpMethod.Post, $"{paypalBase}/v2/checkout/orders/{orderId}/capture");
            captureRequest.Headers.Authorization = new AuthenticationHeaderValue("Bearer", accessToken);
            captureRequest.Headers.Add("PayPal-Request-Id", Guid.NewGuid().ToString());
            captureRequest.Content = new StringContent("{}", Encoding.UTF8, "application/json");
            
            var captureResponse = await _httpClient.SendAsync(captureRequest);
            var captureData = await captureResponse.Content.ReadAsAsync<dynamic>();
            
            if (captureResponse.StatusCode == System.Net.HttpStatusCode.UnprocessableEntity)
            {
                return StatusCode(422, new
                {
                    error = "ORDER_ALREADY_CAPTURED",
                    message = "Order cannot be captured"
                });
            }
            
            if (!captureResponse.IsSuccessStatusCode)
            {
                return StatusCode((int)captureResponse.StatusCode, new
                {
                    error = "CAPTURE_FAILED",
                    message = "Failed to capture order"
                });
            }
            
            var capture = captureData.purchase_units[0].payments.captures[0];
            
            return Ok(new
            {
                id = (string)captureData.id,
                status = (string)captureData.status,
                captureId = (string)capture.id,
                amount = capture.amount,
                payer = captureData.payer,
                create_time = (string)capture.create_time
            });
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { error = "CAPTURE_FAILED", message = "Failed to capture order" });
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

