# Refund payment — C# / ASP.NET Core

Refunds use the Payments API against a **capture id** (not the order id). **Full** refunds omit an amount; **partial** refunds include an `amount` object.

## PayPal API

- **Method:** `POST`
- **Path:** `/v2/payments/captures/{capture_id}/refund`
- **Headers:** `Authorization: Bearer {access_token}`, `Content-Type: application/json`

## Routes (suggested)

```http
POST /paypal-api/checkout/payments/captures/{captureId}/refund
```

## Request model

```csharp
using System.ComponentModel.DataAnnotations;

namespace YourApp.Models.Checkout;

public sealed class RefundCaptureRequest
{
    /// <summary>If null or empty, PayPal refunds the full capture amount.</summary>
    [RegularExpression(@"^\d+\.\d{2}$")]
    public string? Value { get; set; }

    [StringLength(3, MinimumLength = 3)]
    public string CurrencyCode { get; set; } = "USD";

    [MaxLength(300)]
    public string? NoteToPayer { get; set; }
}
```

## Controller

```csharp
using Microsoft.AspNetCore.Mvc;
using YourApp.Models.Checkout;
using YourApp.Services;

namespace YourApp.Controllers;

[ApiController]
[Route("paypal-api/checkout/payments/captures")]
public sealed class PayPalRefundsController : ControllerBase
{
    private readonly IPayPalPaymentsService _payments;

    public PayPalRefundsController(IPayPalPaymentsService payments) => _payments = payments;

    [HttpPost("{captureId}/refund")]
    [Produces("application/json")]
    public async Task<IActionResult> RefundCapture(
        [FromRoute] string captureId,
        [FromBody] RefundCaptureRequest body,
        CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(captureId))
            return BadRequest("captureId is required.");

        if (!ModelState.IsValid)
            return ValidationProblem(ModelState);

        try
        {
            var result = await _payments.RefundCaptureAsync(captureId, body, cancellationToken);
            return Ok(result);
        }
        catch (HttpRequestException ex)
        {
            return Problem(detail: ex.Message, statusCode: StatusCodes.Status502BadGateway);
        }
    }
}
```

## Service

```csharp
using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;
using Microsoft.Extensions.Logging;
using YourApp.Models.Checkout;

namespace YourApp.Services;

public interface IPayPalPaymentsService
{
    Task<JsonElement> RefundCaptureAsync(
        string captureId,
        RefundCaptureRequest request,
        CancellationToken cancellationToken = default);
}

public sealed class PayPalPaymentsService : IPayPalPaymentsService
{
    private readonly IHttpClientFactory _httpClientFactory;
    private readonly IPayPalAccessTokenProvider _tokens;
    private readonly ILogger<PayPalPaymentsService> _logger;

    public PayPalPaymentsService(
        IHttpClientFactory httpClientFactory,
        IPayPalAccessTokenProvider tokens,
        ILogger<PayPalPaymentsService> logger)
    {
        _httpClientFactory = httpClientFactory;
        _tokens = tokens;
        _logger = logger;
    }

    public async Task<JsonElement> RefundCaptureAsync(
        string captureId,
        RefundCaptureRequest request,
        CancellationToken cancellationToken = default)
    {
        var accessToken = await _tokens.GetAccessTokenAsync(cancellationToken);
        var client = _httpClientFactory.CreateClient("PayPal");
        var path = $"/v2/payments/captures/{Uri.EscapeDataString(captureId)}/refund";

        object payload = string.IsNullOrEmpty(request.Value)
            ? new { }
            : new
            {
                amount = new { currency_code = request.CurrencyCode, value = request.Value },
                note_to_payer = request.NoteToPayer
            };

        var options = new JsonSerializerOptions
        {
            PropertyNamingPolicy = JsonNamingPolicy.SnakeCaseLower,
            DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull
        };

        var json = JsonSerializer.Serialize(payload, options);
        if (string.IsNullOrEmpty(request.Value) && !string.IsNullOrEmpty(request.NoteToPayer))
        {
            json = JsonSerializer.Serialize(new { note_to_payer = request.NoteToPayer }, options);
        }

        using var httpRequest = new HttpRequestMessage(HttpMethod.Post, path)
        {
            Content = new StringContent(json, Encoding.UTF8, "application/json")
        };
        httpRequest.Headers.Authorization = new AuthenticationHeaderValue("Bearer", accessToken);
        httpRequest.Headers.TryAddWithoutValidation("PayPal-Request-Id", Guid.NewGuid().ToString("N"));

        using var response = await client.SendAsync(httpRequest, cancellationToken);
        var body = await response.Content.ReadAsStringAsync(cancellationToken);

        if (!response.IsSuccessStatusCode)
        {
            _logger.LogError("Refund failed {Status}: {Body}", response.StatusCode, body);
            throw new HttpRequestException($"PayPal refund failed: {(int)response.StatusCode}");
        }

        using var doc = JsonDocument.Parse(body);
        return doc.RootElement.Clone();
    }
}
```

> Refine the full-refund + `note_to_payer` branch if you need both: build a `Dictionary<string, object?>` or anonymous object with only the fields you send.

## Registration

```csharp
builder.Services.AddSingleton<IPayPalPaymentsService, PayPalPaymentsService>();
```

## Obtaining `capture_id`

After **capture order**, read `purchase_units[0].payments.captures[0].id` from the capture response JSON and persist it with your order record.

## REST base URLs

- **Sandbox:** `https://api-m.sandbox.paypal.com`
- **Production:** `https://api-m.paypal.com`
