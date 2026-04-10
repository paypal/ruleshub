# Capture order — C# / ASP.NET Core

**POST** `/paypal-api/checkout/orders/{orderId}/capture` completes payment for an order that was approved by the buyer (intent **CAPTURE** on create).

## PayPal API

- **Method:** `POST`
- **Path:** `/v2/checkout/orders/{order_id}/capture`
- **Headers:** `Authorization: Bearer {access_token}`, `Content-Type: application/json` (body can be `{}` for simple capture)

## Route

```http
POST /paypal-api/checkout/orders/{orderId}/capture
```

## Controller action

Add to `PayPalCheckoutController` (same `[Route("paypal-api/checkout/orders")]` as create-order). Ensure `IPayPalOrdersService _orders` is injected.

```csharp
[HttpPost("{orderId}/capture")]
[Produces("application/json")]
public async Task<IActionResult> CaptureOrder(
    [FromRoute] string orderId,
    CancellationToken cancellationToken)
{
    if (string.IsNullOrWhiteSpace(orderId))
        return BadRequest("orderId is required.");

    try
    {
        var result = await _orders.CaptureOrderAsync(orderId, cancellationToken);
        return Ok(result);
    }
    catch (HttpRequestException ex)
    {
        return Problem(detail: ex.Message, statusCode: StatusCodes.Status502BadGateway);
    }
}
```

## Interface

```csharp
Task<JsonElement> CaptureOrderAsync(string orderId, CancellationToken cancellationToken = default);
```

## Service implementation

Add to `PayPalOrdersService` (use `partial` if split across files). Reuse `IPayPalAccessTokenProvider` and `IHttpClientFactory` from the create-order snippet.

```csharp
using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using Microsoft.Extensions.Logging;

public async Task<JsonElement> CaptureOrderAsync(string orderId, CancellationToken cancellationToken = default)
{
    var accessToken = await _tokens.GetAccessTokenAsync(cancellationToken);
    var client = _httpClientFactory.CreateClient("PayPal");

    var path = $"/v2/checkout/orders/{Uri.EscapeDataString(orderId)}/capture";
    using var request = new HttpRequestMessage(HttpMethod.Post, path)
    {
        Content = new StringContent("{}", Encoding.UTF8, "application/json")
    };
    request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", accessToken);
    request.Headers.TryAddWithoutValidation("PayPal-Request-Id", Guid.NewGuid().ToString("N"));

    using var response = await client.SendAsync(request, cancellationToken);
    var body = await response.Content.ReadAsStringAsync(cancellationToken);

    if (!response.IsSuccessStatusCode)
    {
        _logger.LogError("Capture failed {Status}: {Body}", response.StatusCode, body);
        throw new HttpRequestException($"PayPal capture failed: {(int)response.StatusCode}");
    }

    using var doc = JsonDocument.Parse(body);
    return doc.RootElement.Clone();
}
```

## Response

Successful responses include order `status` (e.g. `COMPLETED`) and `purchase_units[].payments.captures[]` with capture `id` values for refunds and reconciliation.

## REST base URLs

- **Sandbox:** `https://api-m.sandbox.paypal.com`
- **Production:** `https://api-m.paypal.com`
