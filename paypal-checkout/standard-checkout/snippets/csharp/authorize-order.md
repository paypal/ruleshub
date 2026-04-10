# Authorize order — C# / ASP.NET Core (authorization flow)

Use the **authorization** flow when you must **capture later** (e.g. ship before charge). Create the order with **`intent: "AUTHORIZE"`**, then after buyer approval call **authorize**, and later **capture** against the authorization ID.

## PayPal APIs

| Step | Method | Path |
|------|--------|------|
| Create order | `POST` | `/v2/checkout/orders` with `intent: AUTHORIZE` |
| Authorize after approval | `POST` | `/v2/checkout/orders/{order_id}/authorize` |
| Capture authorization | `POST` | `/v2/payments/authorizations/{authorization_id}/capture` |
| Void authorization | `POST` | `/v2/payments/authorizations/{authorization_id}/void` |

## 1. Create order with `AUTHORIZE`

Same as create-order, but set intent to **AUTHORIZE**:

```csharp
var payload = new
{
    intent = "AUTHORIZE",
    purchase_units = new[]
    {
        new
        {
            amount = new { currency_code = request.CurrencyCode, value = request.Value }
        }
    }
};
```

Expose **POST** `/paypal-api/checkout/orders/create` (or a dedicated route like `/paypal-api/checkout/orders/create-authorize`) that uses the above payload. Validate totals server-side as usual.

## 2. Authorize payment — **POST** `/paypal-api/checkout/orders/{orderId}/authorize`

Proxies to **POST** `/v2/checkout/orders/{order_id}/authorize`.

### Controller

```csharp
[HttpPost("{orderId}/authorize")]
[Produces("application/json")]
public async Task<IActionResult> AuthorizeOrder(
    [FromRoute] string orderId,
    CancellationToken cancellationToken)
{
    if (string.IsNullOrWhiteSpace(orderId))
        return BadRequest("orderId is required.");

    try
    {
        var result = await _orders.AuthorizeOrderAsync(orderId, cancellationToken);
        return Ok(result);
    }
    catch (HttpRequestException ex)
    {
        return Problem(detail: ex.Message, statusCode: StatusCodes.Status502BadGateway);
    }
}
```

### Service

```csharp
using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using Microsoft.Extensions.Logging;

public async Task<JsonElement> AuthorizeOrderAsync(string orderId, CancellationToken cancellationToken = default)
{
    var accessToken = await _tokens.GetAccessTokenAsync(cancellationToken);
    var client = _httpClientFactory.CreateClient("PayPal");
    var path = $"/v2/checkout/orders/{Uri.EscapeDataString(orderId)}/authorize";

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
        _logger.LogError("Authorize failed {Status}: {Body}", response.StatusCode, body);
        throw new HttpRequestException($"PayPal authorize failed: {(int)response.StatusCode}");
    }

    using var doc = JsonDocument.Parse(body);
    return doc.RootElement.Clone();
}
```

From the JSON response, read **`purchase_units[0].payments.authorizations[0].id`** as the **authorization_id** for capture or void.

## 3. Capture authorization — **POST** `/paypal-api/payments/authorizations/{authorizationId}/capture`

Proxies to **POST** `/v2/payments/authorizations/{authorization_id}/capture`.

### Request body (optional partial capture)

```json
{
  "amount": { "currency_code": "USD", "value": "10.00" },
  "final_capture": true
}
```

### Controller

```csharp
[HttpPost("payments/authorizations/{authorizationId}/capture")]
[Produces("application/json")]
public async Task<IActionResult> CaptureAuthorization(
    [FromRoute] string authorizationId,
    [FromBody] CaptureAuthorizationRequest? body,
    CancellationToken cancellationToken)
{
    if (string.IsNullOrWhiteSpace(authorizationId))
        return BadRequest("authorizationId is required.");

    try
    {
        var result = await _orders.CaptureAuthorizationAsync(authorizationId, body, cancellationToken);
        return Ok(result);
    }
    catch (HttpRequestException ex)
    {
        return Problem(detail: ex.Message, statusCode: StatusCodes.Status502BadGateway);
    }
}
```

Use a dedicated route prefix if this does not fit under `orders` (e.g. `[Route("paypal-api/checkout")]` on a second controller).

### Model

```csharp
public sealed class CaptureAuthorizationRequest
{
    public string? CurrencyCode { get; set; }
    public string? Value { get; set; }
    public bool FinalCapture { get; set; } = true;
}
```

### Service (build JSON)

```csharp
public async Task<JsonElement> CaptureAuthorizationAsync(
    string authorizationId,
    CaptureAuthorizationRequest? request,
    CancellationToken cancellationToken = default)
{
    var accessToken = await _tokens.GetAccessTokenAsync(cancellationToken);
    var client = _httpClientFactory.CreateClient("PayPal");
    var path = $"/v2/payments/authorizations/{Uri.EscapeDataString(authorizationId)}/capture";

    object payload = request?.CurrencyCode is not null && request.Value is not null
        ? new
        {
            amount = new { currency_code = request.CurrencyCode, value = request.Value },
            final_capture = request.FinalCapture
        }
        : new { final_capture = true };

    var json = JsonSerializer.Serialize(payload, new JsonSerializerOptions
    {
        PropertyNamingPolicy = JsonNamingPolicy.SnakeCaseLower,
        DefaultIgnoreCondition = System.Text.Json.Serialization.JsonIgnoreCondition.WhenWritingNull
    });

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
        _logger.LogError("Capture authorization failed {Status}: {Body}", response.StatusCode, body);
        throw new HttpRequestException($"PayPal capture authorization failed: {(int)response.StatusCode}");
    }

    using var doc = JsonDocument.Parse(body);
    return doc.RootElement.Clone();
}
```

## 4. Client flow (v5 example)

After `createOrder` returns an order id and the buyer approves, call your **authorize** route instead of **capture**; store **authorization_id**; on shipment call **capture authorization**.

## REST base URLs

- **Sandbox:** `https://api-m.sandbox.paypal.com`
- **Production:** `https://api-m.paypal.com`
