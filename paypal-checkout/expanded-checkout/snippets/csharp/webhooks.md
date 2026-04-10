# Webhooks — ASP.NET Core (Expanded Checkout + vault events)

Subscribe in the PayPal Developer Dashboard to events you need (e.g. **`PAYMENT.CAPTURE.COMPLETED`**, vault lifecycle events). Expose **POST** `/paypal-api/webhooks/paypal` and **verify** each delivery with **POST** `/v1/notifications/verify-webhook-signature` using **`HttpClient`** and **`IConfiguration`** (`PayPal:WebhookId`).

## Configuration

| Key | Purpose |
|-----|---------|
| `PayPal:WebhookId` | Dashboard webhook ID |
| `PayPal:ClientId` / `PayPal:ClientSecret` | OAuth for verification call |

REST base: Sandbox **`https://api-m.sandbox.paypal.com`**, Production **`https://api-m.paypal.com`**

## Raw body middleware

Verification requires the **exact** raw JSON string:

```csharp
app.Use(async (ctx, next) =>
{
    if (ctx.Request.Path.StartsWithSegments("/paypal-api/webhooks/paypal"))
        ctx.Request.EnableBuffering();
    await next();
});
```

## Controller (verify + dispatch)

```csharp
using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Options;

namespace YourApp.Controllers;

[ApiController]
[Route("paypal-api/webhooks")]
public sealed class PayPalWebhooksController : ControllerBase
{
    private readonly IHttpClientFactory _httpClientFactory;
    private readonly IPayPalAccessTokenProvider _tokens;
    private readonly PayPalOptions _options;
    private readonly ILogger<PayPalWebhooksController> _logger;

    public PayPalWebhooksController(
        IHttpClientFactory httpClientFactory,
        IPayPalAccessTokenProvider tokens,
        IOptions<PayPalOptions> options,
        ILogger<PayPalWebhooksController> logger)
    {
        _httpClientFactory = httpClientFactory;
        _tokens = tokens;
        _options = options.Value;
        _logger = logger;
    }

    [HttpPost("paypal")]
    public async Task<IActionResult> Receive(CancellationToken cancellationToken)
    {
        Request.EnableBuffering();
        using var reader = new StreamReader(Request.Body, Encoding.UTF8, leaveOpen: true);
        var bodyText = await reader.ReadToEndAsync(cancellationToken);
        Request.Body.Position = 0;

        if (string.IsNullOrWhiteSpace(_options.WebhookId))
        {
            _logger.LogError("PayPal WebhookId missing.");
            return StatusCode(500);
        }

        var h = Request.Headers;
        var transmissionId = h["PAYPAL-TRANSMISSION-ID"].ToString();
        var transmissionTime = h["PAYPAL-TRANSMISSION-TIME"].ToString();
        var transmissionSig = h["PAYPAL-TRANSMISSION-SIG"].ToString();
        var certUrl = h["PAYPAL-CERT-URL"].ToString();
        var authAlgo = h["PAYPAL-AUTH-ALGO"].ToString();

        if (string.IsNullOrEmpty(transmissionId) || string.IsNullOrEmpty(transmissionSig))
            return BadRequest("Missing PayPal webhook headers.");

        using var webhookEvent = JsonDocument.Parse(bodyText);
        var verified = await VerifySignatureAsync(
            transmissionId, transmissionTime, certUrl, authAlgo, transmissionSig,
            webhookEvent.RootElement, cancellationToken);

        if (!verified)
        {
            _logger.LogWarning("Webhook signature verification failed.");
            return BadRequest();
        }

        var eventType = webhookEvent.RootElement.GetProperty("event_type").GetString();
        _logger.LogInformation("Verified webhook: {EventType}", eventType);

        switch (eventType)
        {
            case "PAYMENT.CAPTURE.COMPLETED":
                // reconcile capture
                break;
            case "VAULT.PAYMENT-TOKEN.CREATED":
            case "VAULT.PAYMENT-TOKEN.DELETED":
            case "VAULT.PAYMENT-TOKEN.UPDATED":
                // sync local vault state / CRM — idempotent by resource id
                break;
            default:
                break;
        }

        return Ok();
    }

    private async Task<bool> VerifySignatureAsync(
        string transmissionId,
        string transmissionTime,
        string certUrl,
        string authAlgo,
        string transmissionSig,
        JsonElement webhookEvent,
        CancellationToken cancellationToken)
    {
        var accessToken = await _tokens.GetAccessTokenAsync(cancellationToken);
        var client = _httpClientFactory.CreateClient("PayPal");

        var payload = new
        {
            transmission_id = transmissionId,
            transmission_time = transmissionTime,
            cert_url = certUrl,
            auth_algo = authAlgo,
            transmission_sig = transmissionSig,
            webhook_id = _options.WebhookId!,
            webhook_event = webhookEvent
        };

        var json = JsonSerializer.Serialize(payload, new JsonSerializerOptions
        {
            PropertyNamingPolicy = JsonNamingPolicy.SnakeCaseLower
        });

        using var request = new HttpRequestMessage(HttpMethod.Post, "/v1/notifications/verify-webhook-signature")
        {
            Content = new StringContent(json, Encoding.UTF8, "application/json")
        };
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", accessToken);

        using var response = await client.SendAsync(request, cancellationToken);
        var body = await response.Content.ReadAsStringAsync(cancellationToken);
        if (!response.IsSuccessStatusCode)
        {
            _logger.LogError("verify-webhook-signature failed: {Body}", body);
            return false;
        }

        using var doc = JsonDocument.Parse(body);
        return doc.RootElement.TryGetProperty("verification_status", out var vs)
            && string.Equals(vs.GetString(), "SUCCESS", StringComparison.OrdinalIgnoreCase);
    }
}
```

## Idempotency

Store **`event.id`** (or resource ids inside **`resource`**) and skip duplicates.

## Vault event names

Exact strings depend on your dashboard subscription and API version; common patterns include **`VAULT.PAYMENT-TOKEN.*`**. Confirm in the [Webhooks reference](https://developer.paypal.com/api/rest/webhooks/) for your app.

## Security

- Return **200** only after verification succeeds (or **400** on bad signature).
- Do not log full PCI-related payloads unnecessarily.
