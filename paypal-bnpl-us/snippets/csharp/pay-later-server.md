# Pay Later Server-Side (C# / ASP.NET Core) — US

Server-side order creation and capture for Pay Later. No special order payload is needed.

Source: https://docs.paypal.ai/reference/api/rest/orders/create-order

## ASP.NET Core Implementation

```csharp
using Microsoft.AspNetCore.Mvc;
using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;

[ApiController]
[Route("paypal-api/checkout/orders")]
public class PayPalOrderController : ControllerBase
{
    private readonly IConfiguration _config;
    private readonly HttpClient _httpClient;

    public PayPalOrderController(IConfiguration config, IHttpClientFactory httpClientFactory)
    {
        _config = config;
        _httpClient = httpClientFactory.CreateClient();
    }

    private string BaseUrl => _config["PayPal:BaseUrl"] ?? "https://api-m.sandbox.paypal.com";

    private async Task<string> GetAccessToken()
    {
        var clientId = _config["PayPal:ClientId"];
        var clientSecret = _config["PayPal:ClientSecret"];
        var auth = Convert.ToBase64String(Encoding.UTF8.GetBytes($"{clientId}:{clientSecret}"));

        var request = new HttpRequestMessage(HttpMethod.Post, $"{BaseUrl}/v1/oauth2/token");
        request.Headers.Authorization = new AuthenticationHeaderValue("Basic", auth);
        request.Content = new StringContent(
            "grant_type=client_credentials",
            Encoding.UTF8,
            "application/x-www-form-urlencoded"
        );

        var response = await _httpClient.SendAsync(request);
        response.EnsureSuccessStatusCode();

        var json = await response.Content.ReadFromJsonAsync<JsonElement>();
        return json.GetProperty("access_token").GetString()!;
    }

    [HttpPost("create")]
    public async Task<IActionResult> CreateOrder([FromBody] JsonElement body)
    {
        try
        {
            var accessToken = await GetAccessToken();
            var amount = body.GetProperty("amount").GetString();
            var currencyCode = body.TryGetProperty("currency_code", out var cc)
                ? cc.GetString() : "USD";

            var orderPayload = new
            {
                intent = "CAPTURE",
                purchase_units = new[] {
                    new {
                        amount = new {
                            currency_code = currencyCode,
                            value = decimal.Parse(amount!).ToString("F2")
                        }
                    }
                }
            };

            var request = new HttpRequestMessage(HttpMethod.Post, $"{BaseUrl}/v2/checkout/orders");
            request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", accessToken);
            request.Headers.Add("PayPal-Request-Id", Guid.NewGuid().ToString());
            request.Content = new StringContent(
                JsonSerializer.Serialize(orderPayload),
                Encoding.UTF8,
                "application/json"
            );

            var response = await _httpClient.SendAsync(request);
            var responseBody = await response.Content.ReadAsStringAsync();

            return StatusCode((int)response.StatusCode, JsonSerializer.Deserialize<JsonElement>(responseBody));
        }
        catch
        {
            return StatusCode(500, new { error = "ORDER_CREATION_FAILED" });
        }
    }

    [HttpPost("{orderId}/capture")]
    public async Task<IActionResult> CaptureOrder(string orderId)
    {
        try
        {
            var accessToken = await GetAccessToken();

            var request = new HttpRequestMessage(HttpMethod.Post,
                $"{BaseUrl}/v2/checkout/orders/{orderId}/capture");
            request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", accessToken);
            request.Headers.Add("PayPal-Request-Id", Guid.NewGuid().ToString());
            request.Content = new StringContent("", Encoding.UTF8, "application/json");

            var response = await _httpClient.SendAsync(request);
            var responseBody = await response.Content.ReadAsStringAsync();

            return StatusCode((int)response.StatusCode, JsonSerializer.Deserialize<JsonElement>(responseBody));
        }
        catch
        {
            return StatusCode(500, new { error = "CAPTURE_FAILED" });
        }
    }
}
```

## Key Points

- No special API fields for Pay Later — standard `POST /v2/checkout/orders` works
- Use `intent: CAPTURE` for Pay Later transactions
- Store credentials in `appsettings.json` or environment variables, never in code
- US Pay in 4: $30–$1,500; Pay Monthly: $49–$10,000
