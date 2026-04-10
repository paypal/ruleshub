# Client token generation — C# / ASP.NET Core (Expanded Checkout)

Server **GET** endpoint that returns a **browser-safe client token** for the PayPal JS SDK (Card Fields, Fastlane, wallets). Obtained via **POST** `/v1/oauth2/token` with **`response_type=client_token`** and **`intent=sdk_init`**, cached in **`IMemoryCache`**.

## Route

- **GET** `/paypal-api/auth/browser-safe-client-token`

## OAuth: POST `/v1/oauth2/token`

- **Auth:** HTTP Basic `client_id:client_secret` (Base64).
- **Body (form):** `grant_type=client_credentials&response_type=client_token&intent=sdk_init`

## `PayPalAuthService.cs`

```csharp
using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Options;

namespace YourApp.Services;

public interface IPayPalAuthService
{
    Task<string> GetBrowserSafeClientTokenAsync(CancellationToken cancellationToken = default);
}

public sealed class PayPalAuthService : IPayPalAuthService
{
    private const string CacheKey = "paypal:browser_safe_client_token";
    private readonly IHttpClientFactory _httpClientFactory;
    private readonly IMemoryCache _cache;
    private readonly PayPalOptions _options;
    private readonly ILogger<PayPalAuthService> _logger;

    public PayPalAuthService(
        IHttpClientFactory httpClientFactory,
        IMemoryCache cache,
        IOptions<PayPalOptions> options,
        ILogger<PayPalAuthService> logger)
    {
        _httpClientFactory = httpClientFactory;
        _cache = cache;
        _options = options.Value;
        _logger = logger;
    }

    public async Task<string> GetBrowserSafeClientTokenAsync(CancellationToken cancellationToken = default)
    {
        if (_cache.TryGetValue(CacheKey, out string? cached) && !string.IsNullOrEmpty(cached))
            return cached;

        var client = _httpClientFactory.CreateClient("PayPal");
        var request = new HttpRequestMessage(HttpMethod.Post, "/v1/oauth2/token");
        var basic = Convert.ToBase64String(
            Encoding.UTF8.GetBytes($"{_options.ClientId}:{_options.ClientSecret}"));
        request.Headers.Authorization = new AuthenticationHeaderValue("Basic", basic);
        request.Headers.Accept.Add(new MediaTypeWithQualityHeaderValue("application/json"));
        request.Content = new FormUrlEncodedContent(new Dictionary<string, string>
        {
            ["grant_type"] = "client_credentials",
            ["response_type"] = "client_token",
            ["intent"] = "sdk_init"
        });

        using var response = await client.SendAsync(request, HttpCompletionOption.ResponseHeadersRead, cancellationToken);
        var body = await response.Content.ReadAsStringAsync(cancellationToken);

        if (!response.IsSuccessStatusCode)
        {
            _logger.LogError("PayPal OAuth client_token failed: {Status} Body: {Body}", response.StatusCode, body);
            throw new InvalidOperationException("Failed to obtain PayPal client token.");
        }

        var tokenResponse = JsonSerializer.Deserialize<OAuthClientTokenResponse>(body, SerializerOptions.Default);
        if (tokenResponse?.AccessToken is null)
            throw new InvalidOperationException("PayPal OAuth response missing access_token.");

        var expiresIn = tokenResponse.ExpiresIn > 0
            ? TimeSpan.FromSeconds(tokenResponse.ExpiresIn - 60)
            : TimeSpan.FromMinutes(25);

        _cache.Set(CacheKey, tokenResponse.AccessToken, new MemoryCacheEntryOptions
        {
            AbsoluteExpirationRelativeToNow = expiresIn
        });

        return tokenResponse.AccessToken;
    }

    private sealed class OAuthClientTokenResponse
    {
        [JsonPropertyName("access_token")]
        public string? AccessToken { get; set; }

        [JsonPropertyName("expires_in")]
        public int ExpiresIn { get; set; }
    }

    private static class SerializerOptions
    {
        public static readonly JsonSerializerOptions Default = new()
        {
            PropertyNameCaseInsensitive = true
        };
    }
}
```

## `PayPalAuthController.cs`

```csharp
using Microsoft.AspNetCore.Mvc;

namespace YourApp.Controllers;

[ApiController]
[Route("paypal-api/auth")]
public sealed class PayPalAuthController : ControllerBase
{
    private readonly IPayPalAuthService _auth;

    public PayPalAuthController(IPayPalAuthService auth) => _auth = auth;

    [HttpGet("browser-safe-client-token")]
    [Produces("application/json")]
    public async Task<IActionResult> GetBrowserSafeClientToken(CancellationToken cancellationToken)
    {
        var token = await _auth.GetBrowserSafeClientTokenAsync(cancellationToken);
        return Ok(new { accessToken = token });
    }
}
```

## Registration (`Program.cs`)

```csharp
builder.Services.AddMemoryCache();
builder.Services.AddHttpClient("PayPal", (sp, client) =>
{
    var opts = sp.GetRequiredService<Microsoft.Extensions.Options.IOptions<PayPalOptions>>().Value;
    client.BaseAddress = new Uri(opts.ApiBaseUrl);
    client.DefaultRequestHeaders.TryAddWithoutValidation("Accept", "application/json");
});
builder.Services.AddSingleton<IPayPalAuthService, PayPalAuthService>();
```

## REST base URLs

- **Sandbox:** `https://api-m.sandbox.paypal.com`
- **Production:** `https://api-m.paypal.com`

## Security

- Lock down **CORS** and **authentication** per your product; do not log full token values in production.
