# Get order details — C# / ASP.NET Core

**GET** `/paypal-api/checkout/orders/{orderId}` proxies to PayPal **GET** `/v2/checkout/orders/{order_id}`.

## PayPal API

- **Method:** `GET`
- **Path:** `/v2/checkout/orders/{order_id}`
- **Headers:** `Authorization: Bearer {access_token}`

## Route

```http
GET /paypal-api/checkout/orders/{orderId}
```

## Controller action

Add to `PayPalCheckoutController`.

```csharp
[HttpGet("{orderId}")]
[Produces("application/json")]
public async Task<IActionResult> GetOrder(
    [FromRoute] string orderId,
    CancellationToken cancellationToken)
{
    if (string.IsNullOrWhiteSpace(orderId))
        return BadRequest("orderId is required.");

    try
    {
        var order = await _orders.GetOrderAsync(orderId, cancellationToken);
        return Content(order, "application/json");
    }
    catch (HttpRequestException ex)
    {
        return Problem(detail: ex.Message, statusCode: StatusCodes.Status502BadGateway);
    }
}
```

## Interface

```csharp
Task<string> GetOrderAsync(string orderId, CancellationToken cancellationToken = default);
```

## Service implementation

```csharp
using System.Net.Http.Headers;
using Microsoft.Extensions.Logging;

public async Task<string> GetOrderAsync(string orderId, CancellationToken cancellationToken = default)
{
    var accessToken = await _tokens.GetAccessTokenAsync(cancellationToken);
    var client = _httpClientFactory.CreateClient("PayPal");
    var path = $"/v2/checkout/orders/{Uri.EscapeDataString(orderId)}";

    using var request = new HttpRequestMessage(HttpMethod.Get, path);
    request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", accessToken);

    using var response = await client.SendAsync(request, cancellationToken);
    var body = await response.Content.ReadAsStringAsync(cancellationToken);

    if (!response.IsSuccessStatusCode)
    {
        _logger.LogError("Get order failed {Status}: {Body}", response.StatusCode, body);
        throw new HttpRequestException($"PayPal get order failed: {(int)response.StatusCode}");
    }

    return body;
}
```

## Strong typing

Deserialize with `System.Text.Json` DTOs aligned to [Orders v2](https://developer.paypal.com/docs/api/orders/v2/#orders_get) or keep raw JSON for flexibility.

## REST base URLs

- **Sandbox:** `https://api-m.sandbox.paypal.com`
- **Production:** `https://api-m.paypal.com`
