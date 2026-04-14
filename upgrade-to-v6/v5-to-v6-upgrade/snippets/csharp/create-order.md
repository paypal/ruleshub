# Create Order (Server-Side)

## ASP.NET Core Implementation

```csharp
[ApiController]
[Route("paypal-api/checkout/orders")]
public class PayPalOrderController : ControllerBase
{
    private readonly IConfiguration _configuration;
    private readonly HttpClient _httpClient;
    
    public PayPalOrderController(IConfiguration configuration, IHttpClientFactory httpClientFactory)
    {
        _configuration = configuration;
        _httpClient = httpClientFactory.CreateClient();
    }
    
    [HttpPost("create")]
    public async Task<IActionResult> CreateOrder([FromBody] dynamic request)
    {
        try
        {
            var amount = (string)request.amount;
            var currency = (string)(request.currency ?? "USD");
            
            if (string.IsNullOrEmpty(amount) || decimal.Parse(amount) <= 0)
            {
                return BadRequest(new { error = "INVALID_AMOUNT", message = "Invalid or missing amount" });
            }
            
            var accessToken = await GetAccessToken();
            var paypalBase = _configuration["PayPal:BaseUrl"] ?? "https://api-m.sandbox.paypal.com";
            
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
                        },
                        description = (string)request.description
                    }
                },
                payment_source = new
                {
                    paypal = new
                    {
                        experience_context = new
                        {
                            payment_method_preference = "IMMEDIATE_PAYMENT_REQUIRED",
                            brand_name = "Your Store Name",
                            locale = "en-US",
                            landing_page = "LOGIN",
                            shipping_preference = "NO_SHIPPING",
                            user_action = "PAY_NOW",
                            return_url = "https://example.com/success",
                            cancel_url = "https://example.com/cancel"
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
            
            if (!response.IsSuccessStatusCode)
            {
                return StatusCode((int)response.StatusCode, orderData);
            }
            
            return Ok(new
            {
                id = (string)orderData.id,
                status = (string)orderData.status,
                links = orderData.links
            });
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { error = "ORDER_CREATION_FAILED", message = "Failed to create order" });
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

