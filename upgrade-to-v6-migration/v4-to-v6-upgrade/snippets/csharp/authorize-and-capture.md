#### Create Order with AUTHORIZE Intent

```csharp
using Microsoft.AspNetCore.Mvc;
using System.Net.Http;
using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;

[HttpPost("create-authorize")]
public async Task<IActionResult> CreateOrderAuthorize([FromBody] JsonElement requestBody)
{
    try
    {
        var accessToken = await _tokenController.GetAccessToken();
        
        var orderPayload = new
        {
            intent = "AUTHORIZE",
            purchase_units = new[]
            {
                new
                {
                    amount = new
                    {
                        currency_code = requestBody.TryGetProperty("currency", out var curr) 
                            ? curr.GetString() : "USD",
                        value = requestBody.GetProperty("amount").GetString()
                    }
                }
            }
        };
        
        var request = new HttpRequestMessage(HttpMethod.Post, $"{_paypalBase}/v2/checkout/orders");
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", accessToken);
        request.Headers.Add("PayPal-Request-Id", Guid.NewGuid().ToString());
        request.Content = new StringContent(
            JsonSerializer.Serialize(orderPayload),
            Encoding.UTF8,
            "application/json"
        );
        
        var response = await _httpClient.SendAsync(request);
        var content = await response.Content.ReadAsStringAsync();
        
        return StatusCode((int)response.StatusCode, JsonSerializer.Deserialize<object>(content));
    }
    catch
    {
        return StatusCode(500, new { error = "ORDER_CREATION_FAILED" });
    }
}
```

#### Authorize Order

```csharp
[HttpPost("{orderId}/authorize")]
public async Task<IActionResult> AuthorizeOrder(string orderId)
{
    try
    {
        var accessToken = await _tokenController.GetAccessToken();
        
        var request = new HttpRequestMessage(HttpMethod.Post, 
            $"{_paypalBase}/v2/checkout/orders/{orderId}/authorize");
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", accessToken);
        request.Headers.Add("PayPal-Request-Id", Guid.NewGuid().ToString());
        request.Content = new StringContent("{}", Encoding.UTF8, "application/json");
        
        var response = await _httpClient.SendAsync(request);
        var content = await response.Content.ReadAsStringAsync();
        var authData = JsonSerializer.Deserialize<JsonElement>(content);
        
        var authorizationId = authData
            .GetProperty("purchase_units")[0]
            .GetProperty("payments")
            .GetProperty("authorizations")[0]
            .GetProperty("id").GetString();
        
        return Ok(new
        {
            authorizationId,
            status = authData.GetProperty("status").GetString(),
            details = authData
        });
    }
    catch
    {
        return StatusCode(500, new { error = "AUTHORIZATION_FAILED" });
    }
}
```

#### Capture Authorization

```csharp
[HttpPost("payments/authorizations/{authorizationId}/capture")]
public async Task<IActionResult> CaptureAuthorization(string authorizationId, [FromBody] JsonElement requestBody)
{
    try
    {
        var accessToken = await _tokenController.GetAccessToken();
        
        var capturePayload = new Dictionary<string, object>();
        
        if (requestBody.TryGetProperty("amount", out var amount))
        {
            capturePayload["amount"] = new
            {
                value = amount.GetString(),
                currency_code = requestBody.TryGetProperty("currency", out var curr) 
                    ? curr.GetString() : "USD"
            };
        }
        
        capturePayload["final_capture"] = requestBody.TryGetProperty("finalCapture", out var fc) 
            ? fc.GetBoolean() : true;
        
        if (requestBody.TryGetProperty("invoiceId", out var invoiceId))
            capturePayload["invoice_id"] = invoiceId.GetString();
        
        if (requestBody.TryGetProperty("noteToPayer", out var note))
            capturePayload["note_to_payer"] = note.GetString();
        
        var request = new HttpRequestMessage(HttpMethod.Post, 
            $"{_paypalBase}/v2/payments/authorizations/{authorizationId}/capture");
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", accessToken);
        request.Headers.Add("PayPal-Request-Id", Guid.NewGuid().ToString());
        request.Content = new StringContent(
            JsonSerializer.Serialize(capturePayload),
            Encoding.UTF8,
            "application/json"
        );
        
        var response = await _httpClient.SendAsync(request);
        var content = await response.Content.ReadAsStringAsync();
        
        return Ok(JsonSerializer.Deserialize<object>(content));
    }
    catch
    {
        return StatusCode(500, new { error = "CAPTURE_FAILED" });
    }
}
```

#### Get Authorization Details

```csharp
[HttpGet("payments/authorizations/{authorizationId}")]
public async Task<IActionResult> GetAuthorizationDetails(string authorizationId)
{
    try
    {
        var accessToken = await _tokenController.GetAccessToken();
        
        var request = new HttpRequestMessage(HttpMethod.Get, 
            $"{_paypalBase}/v2/payments/authorizations/{authorizationId}");
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", accessToken);
        
        var response = await _httpClient.SendAsync(request);
        var content = await response.Content.ReadAsStringAsync();
        
        return Ok(JsonSerializer.Deserialize<object>(content));
    }
    catch
    {
        return StatusCode(500, new { error = "FETCH_FAILED" });
    }
}
```

