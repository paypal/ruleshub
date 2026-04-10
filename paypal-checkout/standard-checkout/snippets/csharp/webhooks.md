# Webhooks — C# / ASP.NET Core

Subscribe to events in the PayPal Developer Dashboard and expose **POST** `/paypal-api/webhooks/paypal` (or similar). **Verify** each delivery using **POST** `/v1/notifications/verify-webhook-signature` with your **webhook id** and the **raw JSON body**.

## Configuration (`IConfiguration`)

| Key | Purpose |
|-----|---------|
| `PayPal:WebhookId` | Webhook ID from the dashboard |
| `PayPal:ClientId` / `PayPal:ClientSecret` | Same REST app used for API calls |

## Incoming headers (PayPal)

| Header | Notes |
|--------|--------|
| `PAYPAL-TRANSMISSION-ID` | |
| `PAYPAL-TRANSMISSION-TIME` | |
| `PAYPAL-TRANSMISSION-SIG` | |
| `PAYPAL-CERT-URL` | |
| `PAYPAL-AUTH-ALGO` | |

## Raw body requirement

Verification needs the **exact** request body string. Enable buffering and read the body as text:

```csharp
app.Use(async (ctx, next) =>
{
    if (ctx.Request.Path.StartsWithSegments("/paypal-api/webhooks/paypal"))
    {
        ctx.Request.EnableBuffering();
    }
    await next();
});
```

## Controller

```csharp
using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
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
            _logger.LogError("PayPal WebhookId is not configured.");
            return StatusCode(500);
        }

        var headers = Request.Headers;
        var transmissionId = headers["PAYPAL-TRANSMISSION-ID"].ToString();
        var transmissionTime = headers["PAYPAL-TRANSMISSION-TIME"].ToString();
        var transmissionSig = headers["PAYPAL-TRANSMISSION-SIG"].ToString();
        var certUrl = headers["PAYPAL-CERT-URL"].ToString();
        var authAlgo = headers["PAYPAL-AUTH-ALGO"].ToString();

        if (string.IsNullOrEmpty(transmissionId) || string.IsNullOrEmpty(transmissionSig))
            return BadRequest("Missing PayPal webhook headers.");

        using var webhookEvent = JsonDocument.Parse(bodyText);
        var verified = await VerifySignatureAsync(
            transmissionId,
            transmissionTime,
            certUrl,
            authAlgo,
            transmissionSig,
            webhookEvent.RootElement,
            cancellationToken);

        if (!verified)
        {
            _logger.LogWarning("Webhook signature verification failed.");
            return BadRequest();
        }

        // Process event idempotently (e.g. CHECKOUT.ORDER.APPROVED, PAYMENT.CAPTURE.COMPLETED)
        var eventType = webhookEvent.RootElement.GetProperty("event_type").GetString();
        _logger.LogInformation("Verified webhook: {EventType}", eventType);

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

        var payload = new VerifyWebhookSignatureRequest
        {
            TransmissionId = transmissionId,
            TransmissionTime = transmissionTime,
            CertUrl = certUrl,
            AuthAlgo = authAlgo,
            TransmissionSig = transmissionSig,
            WebhookId = _options.WebhookId!,
            WebhookEvent = webhookEvent
        };

        var json = JsonSerializer.Serialize(payload, VerifyWebhookJson.Options);

        using var request = new HttpRequestMessage(HttpMethod.Post, "/v1/notifications/verify-webhook-signature")
        {
            Content = new StringContent(json, Encoding.UTF8, "application/json")
        };
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", accessToken);

        using var response = await client.SendAsync(request, cancellationToken);
        var body = await response.Content.ReadAsStringAsync(cancellationToken);
        if (!response.IsSuccessStatusCode)
        {
            _logger.LogError("Verify webhook failed: {Status} {Body}", response.StatusCode, body);
            return false;
        }

        using var doc = JsonDocument.Parse(body);
        return doc.RootElement.TryGetProperty("verification_status", out var status)
               && status.GetString() == "SUCCESS";
    }

    private sealed class VerifyWebhookSignatureRequest
    {
        [System.Text.Json.Serialization.JsonPropertyName("transmission_id")]
        public string TransmissionId { get; set; } = "";

        [System.Text.Json.Serialization.JsonPropertyName("transmission_time")]
        public string TransmissionTime { get; set; } = "";

        [System.Text.Json.Serialization.JsonPropertyName("cert_url")]
        public string CertUrl { get; set; } = "";

        [System.Text.Json.Serialization.JsonPropertyName("auth_algo")]
        public string AuthAlgo { get; set; } = "";

        [System.Text.Json.Serialization.JsonPropertyName("transmission_sig")]
        public string TransmissionSig { get; set; } = "";

        [System.Text.Json.Serialization.JsonPropertyName("webhook_id")]
        public string WebhookId { get; set; } = "";

        [System.Text.Json.Serialization.JsonPropertyName("webhook_event")]
        public JsonElement WebhookEvent { get; set; }
    }

    private static class VerifyWebhookJson
    {
        public static readonly JsonSerializerOptions Options = new()
        {
            DefaultIgnoreCondition = System.Text.Json.Serialization.JsonIgnoreCondition.WhenWritingNull
        };
    }
}
```

## Security

- Return **200** only after verification (or queue then verify—avoid acting on unverified payloads).
- Use **HTTPS** publicly; PayPal sends to your registered URL.
- **Idempotent** processing: the same event may be retried.

## REST base URLs

Verification calls use the same host as other REST APIs:

- **Sandbox:** `https://api-m.sandbox.paypal.com`
- **Production:** `https://api-m.paypal.com`

## Alternative: certificate caching

Production setups sometimes cache **`PAYPAL-CERT-URL`** downloads per PayPal guidance; start with the official **verify-webhook-signature** flow above.
