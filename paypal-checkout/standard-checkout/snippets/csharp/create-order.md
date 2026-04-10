# Create order — C# / ASP.NET Core

**POST** `/paypal-api/checkout/orders/create` creates a PayPal order by calling **POST** `https://api-m.sandbox.paypal.com/v2/checkout/orders` (or production host). Uses **`HttpClient`** with a **Bearer** access token from OAuth **client_credentials** (standard server token, not the browser `client_token`).

## PayPal API

- **Method:** `POST`
- **Path:** `/v2/checkout/orders`
- **Headers:** `Authorization: Bearer {access_token}`, `Content-Type: application/json`, optionally `PayPal-Request-Id` (idempotency)

## Request model (model binding + validation)

```csharp
using System.ComponentModel.DataAnnotations;

namespace YourApp.Models.Checkout;

public sealed class CreateOrderRequest
{
    [Required]
    [StringLength(3, MinimumLength = 3)]
    public string CurrencyCode { get; set; } = "USD";

    [Required]
    [RegularExpression(@"^\d+\.\d{2}$", ErrorMessage = "Amount must be a decimal string with two fractional digits.")]
    public string Value { get; set; } = "";

    /// <summary>Optional: your cart id for reconciliation (maps to purchase_units[0].custom_id).</summary>
    [MaxLength(127)]
    public string? CustomId { get; set; }
}
```

## PayPal JSON payload (anonymous object or DTO)

Use **`System.Text.Json`** with naming that matches PayPal (`snake_case` in JSON). Easiest: build with `JsonSerializer.Serialize` and `JsonNamingPolicy.SnakeCaseLower` (.NET 8+).

## `PayPalCheckoutController.cs` (excerpt)

```csharp
using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using Microsoft.AspNetCore.Mvc;
using YourApp.Models.Checkout;
using YourApp.Services;

namespace YourApp.Controllers;

[ApiController]
[Route("paypal-api/checkout/orders")]
public sealed class PayPalCheckoutController : ControllerBase
{
    private readonly IPayPalOrdersService _orders;

    public PayPalCheckoutController(IPayPalOrdersService orders) => _orders = orders;

    [HttpPost("create")]
    [Produces("application/json")]
    public async Task<IActionResult> CreateOrder(
        [FromBody] CreateOrderRequest body,
        CancellationToken cancellationToken)
    {
        if (!ModelState.IsValid)
            return ValidationProblem(ModelState);

        try
        {
            var orderId = await _orders.CreateOrderAsync(body, cancellationToken);
            return Ok(new { id = orderId });
        }
        catch (HttpRequestException ex)
        {
            return Problem(detail: ex.Message, statusCode: StatusCodes.Status502BadGateway);
        }
    }
}
```

## `IPayPalOrdersService` — create implementation

```csharp
using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using YourApp.Models.Checkout;

namespace YourApp.Services;

public interface IPayPalOrdersService
{
    Task<string> CreateOrderAsync(CreateOrderRequest request, CancellationToken cancellationToken = default);
}

public sealed class PayPalOrdersService : IPayPalOrdersService
{
    private readonly IHttpClientFactory _httpClientFactory;
    private readonly IPayPalAccessTokenProvider _tokens;
    private readonly ILogger<PayPalOrdersService> _logger;

    public PayPalOrdersService(
        IHttpClientFactory httpClientFactory,
        IPayPalAccessTokenProvider tokens,
        ILogger<PayPalOrdersService> logger)
    {
        _httpClientFactory = httpClientFactory;
        _tokens = tokens;
        _logger = logger;
    }

    public async Task<string> CreateOrderAsync(CreateOrderRequest request, CancellationToken cancellationToken = default)
    {
        var accessToken = await _tokens.GetAccessTokenAsync(cancellationToken);

        var payload = new
        {
            intent = "CAPTURE",
            purchase_units = new[]
            {
                new
                {
                    amount = new
                    {
                        currency_code = request.CurrencyCode,
                        value = request.Value
                    },
                    custom_id = request.CustomId
                }
            }
        };

        var json = JsonSerializer.Serialize(payload, PayPalJson.Options);

        var client = _httpClientFactory.CreateClient("PayPal");
        using var httpRequest = new HttpRequestMessage(HttpMethod.Post, "/v2/checkout/orders")
        {
            Content = new StringContent(json, Encoding.UTF8, "application/json")
        };
        httpRequest.Headers.Authorization = new AuthenticationHeaderValue("Bearer", accessToken);
        httpRequest.Headers.TryAddWithoutValidation("PayPal-Request-Id", Guid.NewGuid().ToString("N"));

        using var response = await client.SendAsync(httpRequest, cancellationToken);
        var body = await response.Content.ReadAsStringAsync(cancellationToken);

        if (!response.IsSuccessStatusCode)
        {
            _logger.LogError("Create order failed {Status}: {Body}", response.StatusCode, body);
            throw new HttpRequestException($"PayPal create order failed: {(int)response.StatusCode}");
        }

        var doc = JsonDocument.Parse(body);
        var id = doc.RootElement.GetProperty("id").GetString();
        if (string.IsNullOrEmpty(id))
            throw new InvalidOperationException("PayPal response missing order id.");
        return id;
    }

    private static class PayPalJson
    {
        public static readonly JsonSerializerOptions Options = new()
        {
            DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull,
            PropertyNamingPolicy = JsonNamingPolicy.SnakeCaseLower
        };
    }
}
```

## `IPayPalAccessTokenProvider` (REST Bearer token)

OAuth for **API** calls uses only `grant_type=client_credentials` (no `response_type=client_token`). Cache the bearer token with **`IMemoryCache`** keyed separately from the browser client token.

```csharp
using Microsoft.Extensions.Caching.Memory;

public interface IPayPalAccessTokenProvider
{
    Task<string> GetAccessTokenAsync(CancellationToken cancellationToken = default);
}

public sealed class PayPalAccessTokenProvider : IPayPalAccessTokenProvider
{
    private const string CacheKey = "paypal:rest_access_token";
    private readonly IHttpClientFactory _httpClientFactory;
    private readonly IMemoryCache _cache;
    private readonly PayPalOptions _options;

    public PayPalAccessTokenProvider(
        IHttpClientFactory httpClientFactory,
        IMemoryCache cache,
        IOptions<PayPalOptions> options)
    {
        _httpClientFactory = httpClientFactory;
        _cache = cache;
        _options = options.Value;
    }

    public async Task<string> GetAccessTokenAsync(CancellationToken cancellationToken = default)
    {
        if (_cache.TryGetValue(CacheKey, out string? cached) && !string.IsNullOrEmpty(cached))
            return cached;

        var client = _httpClientFactory.CreateClient("PayPal");
        var request = new HttpRequestMessage(HttpMethod.Post, "/v1/oauth2/token");
        var basic = Convert.ToBase64String(
            Encoding.UTF8.GetBytes($"{_options.ClientId}:{_options.ClientSecret}"));
        request.Headers.Authorization = new AuthenticationHeaderValue("Basic", basic);
        request.Content = new FormUrlEncodedContent(new Dictionary<string, string>
        {
            ["grant_type"] = "client_credentials"
        });

        using var response = await client.SendAsync(request, cancellationToken);
        var body = await response.Content.ReadAsStringAsync(cancellationToken);
        response.EnsureSuccessStatusCode();

        using var doc = JsonDocument.Parse(body);
        var token = doc.RootElement.GetProperty("access_token").GetString();
        var expiresIn = doc.RootElement.TryGetProperty("expires_in", out var exp) ? exp.GetInt32() : 300;

        if (string.IsNullOrEmpty(token))
            throw new InvalidOperationException("Missing access_token");

        _cache.Set(CacheKey, token, TimeSpan.FromSeconds(Math.Max(60, expiresIn - 60)));
        return token;
    }
}
```

## Registration

```csharp
builder.Services.AddSingleton<IPayPalAccessTokenProvider, PayPalAccessTokenProvider>();
builder.Services.AddSingleton<IPayPalOrdersService, PayPalOrdersService>();
```

## Validation rules (business)

- Reject zero or negative amounts after parsing `decimal`.
- Ensure currency is allowed for your merchant account.
- Prefer idempotent creates using a stable `PayPal-Request-Id` per user checkout attempt when retrying.

## REST base URLs

- **Sandbox:** `https://api-m.sandbox.paypal.com`
- **Production:** `https://api-m.paypal.com`
