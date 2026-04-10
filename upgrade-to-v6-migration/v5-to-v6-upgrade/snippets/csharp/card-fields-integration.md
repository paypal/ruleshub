# Card Fields Integration (Server-Side)

## ASP.NET Core Implementation

```csharp
[ApiController]
[Route("paypal-api/checkout/orders")]
public class PayPalCardFieldsController : ControllerBase
{
    private readonly IConfiguration _configuration;
    private readonly HttpClient _httpClient;
    
    public PayPalCardFieldsController(IConfiguration configuration, IHttpClientFactory httpClientFactory)
    {
        _configuration = configuration;
        _httpClient = httpClientFactory.CreateClient();
    }
    
    [HttpPost("create-card-fields")]
    public async Task<IActionResult> CreateOrderForCardFields([FromBody] dynamic request)
    {
        try
        {
            var accessToken = await GetAccessToken();
            var paypalBase = _configuration["PayPal:BaseUrl"] ?? "https://api-m.sandbox.paypal.com";
            
            var amount = (string)request.amount;
            var currency = (string)(request.currency ?? "USD");
            var verificationMethod = (string)(request.verification_method ?? "SCA_WHEN_REQUIRED");
            
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
                            verification = new { method = verificationMethod }
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
    
    [HttpPost("confirm-payment-source")]
    public async Task<IActionResult> ConfirmPaymentSource([FromBody] dynamic request)
    {
        try
        {
            var orderId = (string)request.orderId;
            
            if (string.IsNullOrEmpty(orderId))
            {
                return BadRequest(new { error = "MISSING_ORDER_ID", message = "orderId is required" });
            }
            
            var accessToken = await GetAccessToken();
            var paypalBase = _configuration["PayPal:BaseUrl"] ?? "https://api-m.sandbox.paypal.com";
            
            var payload = new
            {
                payment_source = new
                {
                    card = new
                    {
                        single_use_token = (string)request.single_use_token
                    }
                }
            };
            
            var httpRequest = new HttpRequestMessage(HttpMethod.Post, $"{paypalBase}/v2/checkout/orders/{orderId}/confirm-payment-source");
            httpRequest.Headers.Authorization = new AuthenticationHeaderValue("Bearer", accessToken);
            httpRequest.Headers.Add("PayPal-Request-Id", Guid.NewGuid().ToString());
            httpRequest.Content = new StringContent(
                JsonConvert.SerializeObject(payload),
                Encoding.UTF8,
                "application/json"
            );
            
            var response = await _httpClient.SendAsync(httpRequest);
            var confirmData = await response.Content.ReadAsAsync<dynamic>();
            
            return StatusCode((int)response.StatusCode, confirmData);
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { error = "CONFIRMATION_FAILED" });
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

