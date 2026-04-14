# Use Saved Payment (Server-Side)

## ASP.NET Core Implementation

```csharp
[ApiController]
[Route("paypal-api")]
public class PayPalSavedPaymentController : ControllerBase
{
    private readonly IConfiguration _configuration;
    private readonly HttpClient _httpClient;
    
    public PayPalSavedPaymentController(IConfiguration configuration, IHttpClientFactory httpClientFactory)
    {
        _configuration = configuration;
        _httpClient = httpClientFactory.CreateClient();
    }
    
    [HttpGet("customer/payment-methods")]
    public async Task<IActionResult> GetCustomerPaymentMethods([FromQuery] string customer_id)
    {
        try
        {
            if (string.IsNullOrEmpty(customer_id))
            {
                return BadRequest(new { error = "MISSING_CUSTOMER_ID", message = "customer_id is required" });
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
    
    [HttpPost("checkout/orders/create-with-saved-card")]
    public async Task<IActionResult> CreateOrderWithSavedCard([FromBody] dynamic request)
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
                    card = new { vault_id = vaultId }
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
    
    [HttpPost("checkout/orders/create-with-saved-paypal")]
    public async Task<IActionResult> CreateOrderWithSavedPayPal([FromBody] dynamic request)
    {
        try
        {
            var paymentTokenId = (string)request.paymentTokenId;
            
            if (string.IsNullOrEmpty(paymentTokenId))
            {
                return BadRequest(new { error = "MISSING_PAYMENT_TOKEN", message = "paymentTokenId is required" });
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
                    paypal = new { vault_id = paymentTokenId }
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

