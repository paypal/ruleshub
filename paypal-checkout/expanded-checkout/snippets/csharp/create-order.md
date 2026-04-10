# Create order — C# / ASP.NET Core (Expanded Checkout, card `payment_source`)

**POST** `/paypal-api/checkout/orders/create` calls PayPal **POST** `/v2/checkout/orders` using **`HttpClient`** and a REST **Bearer** token (`grant_type=client_credentials` — not the browser client token).

For **Card Fields**, set **`payment_source.card`** with **`attributes.verification.method`** = **`SCA_WHEN_REQUIRED`** (or **`SCA_ALWAYS`** per your compliance needs).

For **PayPal wallet** buttons on the same integration, configure buyer experience via **`payment_source.paypal.experience_context`** — do **not** use deprecated top-level **`application_context`**.

## PayPal API

- **POST** `/v2/checkout/orders`
- **Headers:** `Authorization: Bearer {access_token}`, `Content-Type: application/json`, optional `PayPal-Request-Id`

## Request model

```csharp
using System.ComponentModel.DataAnnotations;

namespace YourApp.Models.Checkout;

public sealed class CreateExpandedOrderRequest
{
    [Required]
    [StringLength(3, MinimumLength = 3)]
    public string CurrencyCode { get; set; } = "USD";

    [Required]
    [RegularExpression(@"^\d+\.\d{2}$")]
    public string Value { get; set; } = "";

    [MaxLength(127)]
    public string? CustomId { get; set; }

    /// <summary>If true, include PayPal wallet experience_context (not application_context).</summary>
    public bool IncludePayPalExperience { get; set; }
}
```

## Service: create with `payment_source.card`

```csharp
using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;
using Microsoft.Extensions.Logging;
using YourApp.Models.Checkout;

namespace YourApp.Services;

public async Task<string> CreateExpandedCardOrderAsync(
    CreateExpandedOrderRequest request,
    CancellationToken cancellationToken = default)
{
    var accessToken = await _tokens.GetAccessTokenAsync(cancellationToken);

    object paymentSource = new
    {
        card = new
        {
            attributes = new
            {
                verification = new
                {
                    method = "SCA_WHEN_REQUIRED"
                }
            }
        }
    };

    if (request.IncludePayPalExperience)
    {
        paymentSource = new
        {
            card = new
            {
                attributes = new
                {
                    verification = new { method = "SCA_WHEN_REQUIRED" }
                }
            },
            paypal = new
            {
                experience_context = new
                {
                    brand_name = "Your Store",
                    locale = "en-US",
                    landing_page = "NO_PREFERENCE",
                    user_action = "PAY_NOW",
                    return_url = "https://example.com/paypal/return",
                    cancel_url = "https://example.com/paypal/cancel"
                }
            }
        };
    }

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
        },
        payment_source = paymentSource
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

    using var doc = JsonDocument.Parse(body);
    return doc.RootElement.GetProperty("id").GetString()
        ?? throw new InvalidOperationException("Missing order id.");
}

private static class PayPalJson
{
    public static readonly JsonSerializerOptions Options = new()
    {
        DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull,
        PropertyNamingPolicy = JsonNamingPolicy.SnakeCaseLower
    };
}
```

## Controller excerpt

```csharp
[HttpPost("create")]
[Produces("application/json")]
public async Task<IActionResult> CreateOrder(
    [FromBody] CreateExpandedOrderRequest body,
    CancellationToken cancellationToken)
{
    if (!ModelState.IsValid)
        return ValidationProblem(ModelState);

    var orderId = await _orders.CreateExpandedCardOrderAsync(body, cancellationToken);
    return Ok(new { id = orderId });
}
```

## REST base URLs

- **Sandbox:** `https://api-m.sandbox.paypal.com`
- **Production:** `https://api-m.paypal.com`

## Notes

- Use **`payment_source.paypal.experience_context`** for return/cancel URLs and UX when the PayPal wallet is in scope; avoid legacy **`application_context`** on new work.
- Card-only flows typically only need **`payment_source.card`** with verification settings.
