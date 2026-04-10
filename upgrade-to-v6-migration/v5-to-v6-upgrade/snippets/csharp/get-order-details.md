# Get Order Details (Server-Side)

## ASP.NET Core Implementation

```csharp
[ApiController]
[Route("paypal-api/checkout/orders")]
public class PayPalOrderDetailsController : ControllerBase
{
    private readonly IConfiguration _configuration;
    private readonly HttpClient _httpClient;
    
    public PayPalOrderDetailsController(IConfiguration configuration, IHttpClientFactory httpClientFactory)
    {
        _configuration = configuration;
        _httpClient = httpClientFactory.CreateClient();
    }
    
    [HttpGet("{orderId}")]
    public async Task<IActionResult> GetOrderDetails(string orderId)
    {
        try
        {
            if (string.IsNullOrEmpty(orderId))
            {
                return BadRequest(new { error = "INVALID_ORDER_ID", message = "Order ID is required" });
            }
            
            var accessToken = await GetAccessToken();
            var paypalBase = _configuration["PayPal:BaseUrl"] ?? "https://api-m.sandbox.paypal.com";
            
            var request = new HttpRequestMessage(HttpMethod.Get, $"{paypalBase}/v2/checkout/orders/{orderId}");
            request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", accessToken);
            
            var response = await _httpClient.SendAsync(request);
            
            if (response.StatusCode == System.Net.HttpStatusCode.NotFound)
            {
                return NotFound(new { error = "ORDER_NOT_FOUND", message = "Order not found" });
            }
            
            if (!response.IsSuccessStatusCode)
            {
                return StatusCode((int)response.StatusCode, new { error = "FETCH_FAILED", message = "Failed to fetch order" });
            }
            
            var orderData = await response.Content.ReadAsAsync<dynamic>();
            return Ok(orderData);
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { error = "FETCH_FAILED", message = "Failed to fetch order details" });
        }
    }
    
    [HttpGet("{orderId}/summary")]
    public async Task<IActionResult> GetOrderSummary(string orderId)
    {
        try
        {
            var accessToken = await GetAccessToken();
            var paypalBase = _configuration["PayPal:BaseUrl"] ?? "https://api-m.sandbox.paypal.com";
            
            var request = new HttpRequestMessage(HttpMethod.Get, $"{paypalBase}/v2/checkout/orders/{orderId}");
            request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", accessToken);
            
            var response = await _httpClient.SendAsync(request);
            
            if (!response.IsSuccessStatusCode)
            {
                return NotFound(new { error = "ORDER_NOT_FOUND" });
            }
            
            var orderData = await response.Content.ReadAsAsync<dynamic>();
            
            var captures = orderData.purchase_units[0]?.payments?.captures ?? new object[0];
            var authorizations = orderData.purchase_units[0]?.payments?.authorizations ?? new object[0];
            
            var summary = new
            {
                id = (string)orderData.id,
                status = (string)orderData.status,
                amount = orderData.purchase_units[0].amount,
                payer = orderData.payer,
                captureId = captures.Length > 0 ? (string)captures[0].id : null,
                authorizationId = authorizations.Length > 0 ? (string)authorizations[0].id : null,
                create_time = (string)orderData.create_time,
                update_time = (string)orderData.update_time
            };
            
            return Ok(summary);
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

