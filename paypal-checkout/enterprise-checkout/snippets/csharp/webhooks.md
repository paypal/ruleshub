# Webhooks — `gateway.WebhookNotification.Parse()`, PayPal `verify-webhook-signature`

Verify signatures **before** acting on payloads. Respond **200** quickly and process asynchronously for heavy work.

## Braintree — `gateway.WebhookNotification.Parse`

Configure the webhook URL in the **Braintree Control Panel**. Braintree typically posts **`application/x-www-form-urlencoded`** fields **`bt_signature`** and **`bt_payload`** (see [Braintree webhooks — .NET](https://developer.paypal.com/braintree/docs/guides/webhooks/parse/dotnet)).

```csharp
using Braintree;
using Microsoft.AspNetCore.Mvc;

namespace YourApp.Controllers;

[ApiController]
public sealed class BraintreeWebhookController : ControllerBase
{
    private readonly BraintreeGateway _gateway;

    public BraintreeWebhookController(BraintreeGateway gateway) => _gateway = gateway;

    [HttpPost("/webhooks/braintree")]
    [Consumes("application/x-www-form-urlencoded")]
    public IActionResult Braintree([FromForm] string? bt_signature, [FromForm] string? bt_payload)
    {
        if (string.IsNullOrEmpty(bt_signature) || string.IsNullOrEmpty(bt_payload))
            return BadRequest();

        WebhookNotification notification;
        try
        {
            notification = _gateway.WebhookNotification.Parse(bt_signature, bt_payload);
        }
        catch
        {
            return BadRequest();
        }

        var kind = notification.Kind.ToString();
        switch (kind)
        {
            case "TRANSACTION_SETTLED":
                // notification.Transaction
                break;
            case "TRANSACTION_SETTLEMENT_DECLINED":
                break;
            case "DISPUTE_OPENED":
                break;
            case "DISPUTE_LOST":
            case "DISPUTE_WON":
                break;
            case "SUBSCRIPTION_CHARGED_SUCCESSFULLY":
            case "SUBSCRIPTION_CHARGED_UNSUCCESSFULLY":
                break;
            default:
                break;
        }

        return Ok();
    }
}
```

Use **`gateway.WebhookNotification.Parse`** so invalid signatures fail closed ( **`InvalidSignatureException`** in the SDK).

### Common `kind` values (examples)

- **`TRANSACTION_SETTLED`**, **`TRANSACTION_SETTLEMENT_DECLINED`**
- **`DISPUTE_OPENED`**, **`DISPUTE_LOST`**, **`DISPUTE_WON`**
- Subscription lifecycle events if you use Braintree subscriptions

## PayPal — `POST /v1/notifications/verify-webhook-signature`

```csharp
using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using System.Text.Json.Nodes;

namespace YourApp.Controllers;

[ApiController]
public sealed class PayPalWebhookController : ControllerBase
{
    private readonly IHttpClientFactory _httpClientFactory;
    private readonly IConfiguration _configuration;
    private readonly PayPalOAuthClient _oauth;

    public PayPalWebhookController(
        IHttpClientFactory httpClientFactory,
        IConfiguration configuration,
        PayPalOAuthClient oauth)
    {
        _httpClientFactory = httpClientFactory;
        _configuration = configuration;
        _oauth = oauth;
    }

    [HttpPost("/webhooks/paypal")]
    public async Task<IActionResult> PayPal(
        [FromHeader(Name = "PAYPAL-AUTH-ALGO")] string? authAlgo,
        [FromHeader(Name = "PAYPAL-CERT-URL")] string? certUrl,
        [FromHeader(Name = "PAYPAL-TRANSMISSION-ID")] string? transmissionId,
        [FromHeader(Name = "PAYPAL-TRANSMISSION-SIG")] string? transmissionSig,
        [FromHeader(Name = "PAYPAL-TRANSMISSION-TIME")] string? transmissionTime,
        [FromBody] JsonElement webhookEvent,
        CancellationToken cancellationToken)
    {
        var webhookId = _configuration["PayPal:WebhookId"];
        if (string.IsNullOrEmpty(webhookId))
            return StatusCode(500);

        var root = new JsonObject
        {
            ["auth_algo"] = authAlgo ?? "",
            ["cert_url"] = certUrl ?? "",
            ["transmission_id"] = transmissionId ?? "",
            ["transmission_sig"] = transmissionSig ?? "",
            ["transmission_time"] = transmissionTime ?? "",
            ["webhook_id"] = webhookId,
            ["webhook_event"] = JsonNode.Parse(webhookEvent.GetRawText()),
        };

        var json = root.ToJsonString();

        var client = _httpClientFactory.CreateClient("PayPal");
        var accessToken = await _oauth.GetAccessTokenAsync(cancellationToken).ConfigureAwait(false);

        using var request = new HttpRequestMessage(
            HttpMethod.Post,
            "v1/notifications/verify-webhook-signature");
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", accessToken);
        request.Content = new StringContent(json, Encoding.UTF8, "application/json");

        using var response = await client.SendAsync(request, cancellationToken).ConfigureAwait(false);
        var body = await response.Content.ReadAsStringAsync(cancellationToken).ConfigureAwait(false);
        if (!response.IsSuccessStatusCode)
            return StatusCode(500);

        using var verifyDoc = JsonDocument.Parse(body);
        if (verifyDoc.RootElement.GetProperty("verification_status").GetString() != "SUCCESS")
            return BadRequest();

        var eventType = webhookEvent.GetProperty("event_type").GetString();
        switch (eventType)
        {
            case "PAYMENT.CAPTURE.COMPLETED":
                break;
            case "PAYMENT.CAPTURE.DENIED":
            case "PAYMENT.CAPTURE.REFUNDED":
                break;
            case "MERCHANT.ONBOARDING.COMPLETED":
                break;
            case "CUSTOMER.MERCHANT-INTEGRATION.SELLER-ONBOARDING.STARTED":
            case "CUSTOMER.MERCHANT-INTEGRATION.SELLER-ONBOARDING.COMPLETED":
                break;
            default:
                break;
        }

        return Ok();
    }
}
```

Register **`PayPalOAuthClient`** from `seller-onboarding.md` in DI. The **`PayPal`** named `HttpClient` must use the REST base URL from `prerequisites.md`.

### Common `event_type` values (examples)

- **`PAYMENT.CAPTURE.COMPLETED`**, **`PAYMENT.CAPTURE.DENIED`**, **`PAYMENT.CAPTURE.REFUNDED`**
- **`MERCHANT.ONBOARDING.COMPLETED`**
- Seller onboarding variants under **`CUSTOMER.MERCHANT-INTEGRATION.*`**

Store **`PayPal:WebhookId`** from the developer dashboard for verification. Log **`paypal-debug-id`** on failures.
