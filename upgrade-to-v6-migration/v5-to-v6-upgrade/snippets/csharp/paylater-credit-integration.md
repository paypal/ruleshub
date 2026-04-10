# Pay Later & Credit Integration (Server-Side)

## ASP.NET Core Implementation

```csharp
[ApiController]
[Route("paypal-api/checkout/orders")]
public class PayPalPayLaterController : ControllerBase
{
    private readonly IConfiguration _configuration;
    private readonly HttpClient _httpClient;
    
    public PayPalPayLaterController(IConfiguration configuration, IHttpClientFactory httpClientFactory)
    {
        _configuration = configuration;
        _httpClient = httpClientFactory.CreateClient();
    }
    
    [HttpPost("create-paylater")]
    public async Task<IActionResult> CreateOrderForPayLater([FromBody] dynamic request)
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
                        },
                        description = (string)(request.description ?? "Purchase")
                    }
                },
                payment_source = new
                {
                    pay_upon_invoice = new
                    {
                        experience_context = new
                        {
                            payment_method_preference = "IMMEDIATE_PAYMENT_REQUIRED",
                            brand_name = (string)(request.brand_name ?? "Your Store"),
                            locale = "en-US",
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
            
            return StatusCode((int)response.StatusCode, orderData);
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { error = "ORDER_CREATION_FAILED" });
        }
    }
    
    [HttpPost("create-credit")]
    public async Task<IActionResult> CreateOrderForCredit([FromBody] dynamic request)
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
                            value = decimal.Parse(amount).ToString("F2"),
                            breakdown = new
                            {
                                item_total = new
                                {
                                    currency_code = currency,
                                    value = decimal.Parse(amount).ToString("F2")
                                }
                            }
                        },
                        items = request.items
                    }
                },
                payment_source = new
                {
                    paypal = new
                    {
                        experience_context = new
                        {
                            payment_method_preference = "IMMEDIATE_PAYMENT_REQUIRED",
                            brand_name = (string)(request.brand_name ?? "Your Store"),
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
            
            return StatusCode((int)response.StatusCode, orderData);
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { error = "ORDER_CREATION_FAILED" });
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

