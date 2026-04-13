#### Create Order (Basic)

```csharp
using Microsoft.AspNetCore.Mvc;
using System.Net.Http;
using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;

[ApiController]
[Route("paypal-api/checkout/orders")]
public class PayPalOrderController : ControllerBase
{
    private readonly string _paypalBase = Environment.GetEnvironmentVariable("PAYPAL_BASE") ?? "https://api-m.sandbox.paypal.com";
    private readonly HttpClient _httpClient;
    private readonly PayPalTokenController _tokenController;

    public PayPalOrderController(IHttpClientFactory httpClientFactory, PayPalTokenController tokenController)
    {
        _httpClient = httpClientFactory.CreateClient();
        _tokenController = tokenController;
    }

    [HttpPost("create")]
    public async Task<IActionResult> CreateOrder([FromBody] JsonElement requestBody)
    {
        try
        {
            var accessToken = await _tokenController.GetAccessToken();
            
            var orderPayload = new
            {
                intent = "CAPTURE",
                purchase_units = new[]
                {
                    new
                    {
                        amount = new
                        {
                            currency_code = requestBody.TryGetProperty("currency", out var currency) 
                                ? currency.GetString() : "USD",
                            value = requestBody.GetProperty("amount").GetString()
                        }
                    }
                }
            };
            
            var request = new HttpRequestMessage(HttpMethod.Post, $"{_paypalBase}/v2/checkout/orders");
            request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", accessToken);
            request.Headers.Add("PayPal-Request-Id", Guid.NewGuid().ToString());
            request.Content = new StringContent(
                JsonSerializer.Serialize(orderPayload),
                Encoding.UTF8,
                "application/json"
            );
            
            var response = await _httpClient.SendAsync(request);
            var content = await response.Content.ReadAsStringAsync();
            
            return StatusCode((int)response.StatusCode, JsonSerializer.Deserialize<object>(content));
        }
        catch
        {
            return StatusCode(500, new { error = "ORDER_CREATION_FAILED" });
        }
    }
}
```

#### Create Order with Details

```csharp
[HttpPost("create-with-details")]
public async Task<IActionResult> CreateOrderWithDetails([FromBody] JsonElement requestBody)
{
    try
    {
        var accessToken = await _tokenController.GetAccessToken();
        
        var items = new List<object>();
        if (requestBody.TryGetProperty("items", out var itemsArray))
        {
            foreach (var item in itemsArray.EnumerateArray())
            {
                items.Add(new
                {
                    name = item.GetProperty("name").GetString(),
                    quantity = item.GetProperty("quantity").GetInt32().ToString(),
                    unit_amount = new
                    {
                        currency_code = requestBody.TryGetProperty("currency", out var curr) 
                            ? curr.GetString() : "USD",
                        value = item.GetProperty("price").GetString()
                    },
                    sku = item.TryGetProperty("sku", out var sku) ? sku.GetString() : null
                });
            }
        }
        
        var details = requestBody.TryGetProperty("details", out var det) ? det : default;
        var currency = requestBody.TryGetProperty("currency", out var c) ? c.GetString() : "USD";
        
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
                        value = requestBody.GetProperty("amount").GetString(),
                        breakdown = new
                        {
                            item_total = new
                            {
                                currency_code = currency,
                                value = details.TryGetProperty("subtotal", out var sub) 
                                    ? sub.GetString() : requestBody.GetProperty("amount").GetString()
                            },
                            shipping = new
                            {
                                currency_code = currency,
                                value = details.TryGetProperty("shipping", out var ship) 
                                    ? ship.GetString() : "0.00"
                            },
                            tax_total = new
                            {
                                currency_code = currency,
                                value = details.TryGetProperty("tax", out var tax) 
                                    ? tax.GetString() : "0.00"
                            }
                        }
                    },
                    description = requestBody.TryGetProperty("description", out var desc) 
                        ? desc.GetString() : "Purchase",
                    items = items.ToArray()
                }
            }
        };
        
        var request = new HttpRequestMessage(HttpMethod.Post, $"{_paypalBase}/v2/checkout/orders");
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", accessToken);
        request.Headers.Add("PayPal-Request-Id", Guid.NewGuid().ToString());
        request.Content = new StringContent(
            JsonSerializer.Serialize(orderPayload),
            Encoding.UTF8,
            "application/json"
        );
        
        var response = await _httpClient.SendAsync(request);
        var content = await response.Content.ReadAsStringAsync();
        
        return StatusCode((int)response.StatusCode, JsonSerializer.Deserialize<object>(content));
    }
    catch
    {
        return StatusCode(500, new { error = "ORDER_CREATION_FAILED" });
    }
}
```

