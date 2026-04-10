# Error Handling (Server-Side)

## ASP.NET Core Implementation

```csharp
[ApiController]
[Route("paypal-api")]
public class PayPalErrorHandlingController : ControllerBase
{
    private readonly IConfiguration _configuration;
    private readonly HttpClient _httpClient;
    private readonly ILogger<PayPalErrorHandlingController> _logger;
    
    public PayPalErrorHandlingController(
        IConfiguration configuration,
        IHttpClientFactory httpClientFactory,
        ILogger<PayPalErrorHandlingController> logger)
    {
        _configuration = configuration;
        _httpClient = httpClientFactory.CreateClient();
        _logger = logger;
    }
    
    [HttpPost("checkout/orders/create-with-error-handling")]
    public async Task<IActionResult> CreateOrderWithErrorHandling([FromBody] dynamic request)
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
                }
            };
            
            var httpRequest = new HttpRequestMessage(HttpMethod.Post, $"{paypalBase}/v2/checkout/orders");
            httpRequest.Headers.Authorization = new AuthenticationHeaderValue("Bearer", accessToken);
            httpRequest.Content = new StringContent(
                JsonConvert.SerializeObject(orderPayload),
                Encoding.UTF8,
                "application/json"
            );
            
            var response = await _httpClient.SendAsync(httpRequest);
            var responseContent = await response.Content.ReadAsStringAsync();
            
            if (response.IsSuccessStatusCode)
            {
                return Ok(JsonConvert.DeserializeObject(responseContent));
            }
            
            var debugId = response.Headers.GetValues("PayPal-Debug-Id").FirstOrDefault() ?? "N/A";
            var errorData = JsonConvert.DeserializeObject<dynamic>(responseContent);
            
            LogPayPalError("create_order", debugId, (int)response.StatusCode, responseContent);
            
            if (response.StatusCode == System.Net.HttpStatusCode.BadRequest)
            {
                return BadRequest(HandleValidationError(errorData, debugId));
            }
            else if (response.StatusCode == System.Net.HttpStatusCode.Unauthorized)
            {
                return Unauthorized(HandleAuthenticationError(debugId));
            }
            else if (response.StatusCode == System.Net.HttpStatusCode.UnprocessableEntity)
            {
                return StatusCode(422, HandlePaymentError(errorData, debugId));
            }
            
            return StatusCode((int)response.StatusCode, new
            {
                error = "ORDER_CREATION_FAILED",
                debugId,
                message = "Failed to create order"
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Unexpected error creating order");
            return StatusCode(500, new { error = "INTERNAL_ERROR", message = "An unexpected error occurred" });
        }
    }
    
    private object HandleValidationError(dynamic errorData, string debugId)
    {
        return new
        {
            error = "VALIDATION_ERROR",
            debugId,
            message = "Invalid request data"
        };
    }
    
    private object HandleAuthenticationError(string debugId)
    {
        return new
        {
            error = "AUTHENTICATION_FAILED",
            debugId,
            message = "Invalid or expired credentials"
        };
    }
    
    private object HandlePaymentError(dynamic errorData, string debugId)
    {
        return new
        {
            error = "PAYMENT_ERROR",
            debugId,
            message = "Payment could not be processed"
        };
    }
    
    private void LogPayPalError(string operation, string debugId, int statusCode, string errorBody)
    {
        _logger.LogError("PayPal API Error:");
        _logger.LogError($"  Operation: {operation}");
        _logger.LogError($"  Debug ID: {debugId}");
        _logger.LogError($"  Status Code: {statusCode}");
        _logger.LogError($"  Error Body: {errorBody}");
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

