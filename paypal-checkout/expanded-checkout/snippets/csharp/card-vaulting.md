# Card vaulting — C# / ASP.NET Core (`HttpClient`)

Vaulting lets returning customers pay with a saved card. Typical flow: browser obtains a **setup token** via JS SDK, your server exchanges it for a **payment token** with **Vault API**, then you reference the vaulted instrument on future charges. You can also vault **with a purchase** or **without purchase** per product docs.

## REST endpoints (relative to API base)

| Purpose | Method | Path |
|---------|--------|------|
| Setup token | POST | `/v3/vault/setup-tokens` |
| Payment token | POST | `/v3/vault/payment-tokens` |

**Base URLs:** Sandbox `https://api-m.sandbox.paypal.com`, Production `https://api-m.paypal.com`

## Configuration (`IConfiguration`)

Same **`PayPalOptions`** as prerequisites: **ClientId**, **ClientSecret**, **Environment** → **`ApiBaseUrl`**.

## Create payment token from setup token (server)

```csharp
using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;

public sealed class PayPalVaultService
{
    private readonly IHttpClientFactory _httpClientFactory;
    private readonly IPayPalAccessTokenProvider _tokens;
    private readonly ILogger<PayPalVaultService> _logger;

    public PayPalVaultService(
        IHttpClientFactory httpClientFactory,
        IPayPalAccessTokenProvider tokens,
        ILogger<PayPalVaultService> logger)
    {
        _httpClientFactory = httpClientFactory;
        _tokens = tokens;
        _logger = logger;
    }

    /// <summary>Exchanges a buyer setup_token (from JS SDK) for a vaulted payment_token id.</summary>
    public async Task<string> CreatePaymentTokenAsync(
        string setupTokenId,
        CancellationToken cancellationToken = default)
    {
        var accessToken = await _tokens.GetAccessTokenAsync(cancellationToken);
        var client = _httpClientFactory.CreateClient("PayPal");

        var payload = new
        {
            payment_source = new
            {
                token = new { id = setupTokenId, type = "SETUP_TOKEN" }
            }
        };
        var json = JsonSerializer.Serialize(payload, JsonOptions);

        using var request = new HttpRequestMessage(HttpMethod.Post, "/v3/vault/payment-tokens")
        {
            Content = new StringContent(json, Encoding.UTF8, "application/json")
        };
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", accessToken);

        using var response = await client.SendAsync(request, cancellationToken);
        var body = await response.Content.ReadAsStringAsync(cancellationToken);

        if (!response.IsSuccessStatusCode)
        {
            _logger.LogError("Vault payment-token failed {Status}: {Body}", response.StatusCode, body);
            throw new HttpRequestException($"Vault payment-token failed: {(int)response.StatusCode}");
        }

        using var doc = JsonDocument.Parse(body);
        return doc.RootElement.GetProperty("id").GetString()
            ?? throw new InvalidOperationException("Missing payment token id.");
    }

    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.SnakeCaseLower,
        DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull
    };
}
```

## Controller: accept setup token from browser

```csharp
public sealed record VaultPaymentTokenRequest([property: System.ComponentModel.DataAnnotations.Required] string SetupTokenId);

[ApiController]
[Route("paypal-api/vault")]
public sealed class PayPalVaultController : ControllerBase
{
    private readonly PayPalVaultService _vault;

    public PayPalVaultController(PayPalVaultService vault) => _vault = vault;

    [HttpPost("payment-tokens")]
    public async Task<IActionResult> CreatePaymentToken(
        [FromBody] VaultPaymentTokenRequest body,
        CancellationToken cancellationToken)
    {
        if (!ModelState.IsValid)
            return ValidationProblem(ModelState);

        var id = await _vault.CreatePaymentTokenAsync(body.SetupTokenId, cancellationToken);
        return Ok(new { id });
    }
}
```

## Charging with a vaulted instrument later

When creating an order, reference the vaulted token per current Orders/Vault docs (e.g. **`payment_source`** with token or card vault id). Align payload fields with the latest **Vault + Orders** documentation for your integration path.

## With purchase / without purchase

- **With purchase:** Card Fields vaulting during checkout — follow [Save cards with purchase (v6)](https://docs.paypal.ai/payments/save/sdk/cards/js-sdk-v6-vault).
- **Without purchase:** [Save cards without purchase](https://docs.paypal.ai/payments/save/sdk/cards/js-sdk-v6-vault-no-purchase).

Server-side, you still use **`HttpClient`** against **`ApiBaseUrl`** and OAuth **Bearer** tokens.
