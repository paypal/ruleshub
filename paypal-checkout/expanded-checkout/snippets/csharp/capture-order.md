# Capture order — C# / ASP.NET Core (Expanded Checkout, card response)

**POST** `/v2/checkout/orders/{order_id}/capture` completes payment after the buyer approves (Card Fields, 3DS, or wallet). Parse the JSON to read **capture ids**, **status**, and card **authentication** fields such as **`liability_shift`** when present.

## Route

```http
POST /paypal-api/checkout/orders/{orderId}/capture
```

## Controller

```csharp
[HttpPost("{orderId}/capture")]
[Produces("application/json")]
public async Task<IActionResult> CaptureOrder(
    [FromRoute] string orderId,
    CancellationToken cancellationToken)
{
    if (string.IsNullOrWhiteSpace(orderId))
        return BadRequest("orderId is required.");

    var result = await _orders.CaptureOrderAsync(orderId, cancellationToken);
    return Ok(result);
}
```

## Service: capture + parse `liability_shift`

Paths may vary slightly by API version; use defensive **`TryGetProperty`** checks.

```csharp
using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;

public async Task<CaptureOrderResult> CaptureOrderAsync(
    string orderId,
    CancellationToken cancellationToken = default)
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
    var root = doc.RootElement;

    var orderStatus = root.TryGetProperty("status", out var st) ? st.GetString() : null;
    string? liabilityShift = null;
    string? captureId = null;

    if (root.TryGetProperty("purchase_units", out var units) && units.GetArrayLength() > 0)
    {
        var pu = units[0];
        if (pu.TryGetProperty("payments", out var payments) &&
            payments.TryGetProperty("captures", out var captures) &&
            captures.GetArrayLength() > 0)
        {
            var cap = captures[0];
            captureId = cap.TryGetProperty("id", out var cid) ? cid.GetString() : null;

            if (cap.TryGetProperty("processor_response", out var proc) &&
                proc.TryGetProperty("liability_shift", out var ls))
            {
                liabilityShift = ls.GetString();
            }

            if (liabilityShift is null && cap.TryGetProperty("authentication_result", out var auth) &&
                auth.TryGetProperty("liability_shift", out var ls2))
            {
                liabilityShift = ls2.GetString();
            }
        }
    }

    return new CaptureOrderResult(orderStatus, captureId, liabilityShift, Raw: root.Clone());
}

public sealed record CaptureOrderResult(
    string? OrderStatus,
    string? CaptureId,
    string? LiabilityShift,
    JsonElement Raw);
```

## Using the raw payload

Expose **`Raw`** to your reconciliation layer or map fields explicitly once you confirm the exact shape for your merchant’s responses (log **`PayPal-Debug-Id`** on errors).

## REST base URLs

- **Sandbox:** `https://api-m.sandbox.paypal.com`
- **Production:** `https://api-m.paypal.com`
