#### Full Refund

```csharp
using Microsoft.AspNetCore.Mvc;
using System.Net.Http;
using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;

[HttpPost("payments/captures/{captureId}/refund")]
public async Task<IActionResult> RefundPayment(string captureId)
{
    try
    {
        var accessToken = await _tokenController.GetAccessToken();
        
        var request = new HttpRequestMessage(HttpMethod.Post, 
            $"{_paypalBase}/v2/payments/captures/{captureId}/refund");
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", accessToken);
        request.Headers.Add("PayPal-Request-Id", Guid.NewGuid().ToString());
        request.Content = new StringContent("{}", Encoding.UTF8, "application/json");
        
        var response = await _httpClient.SendAsync(request);
        var content = await response.Content.ReadAsStringAsync();
        
        return Ok(JsonSerializer.Deserialize<object>(content));
    }
    catch
    {
        return StatusCode(500, new { error = "REFUND_FAILED" });
    }
}
```

#### Partial Refund

```csharp
[HttpPost("payments/captures/{captureId}/refund-partial")]
public async Task<IActionResult> RefundPaymentPartial(string captureId, [FromBody] JsonElement requestBody)
{
    try
    {
        var accessToken = await _tokenController.GetAccessToken();
        
        var refundPayload = new Dictionary<string, object>
        {
            ["amount"] = new
            {
                value = requestBody.GetProperty("amount").GetString(),
                currency_code = requestBody.TryGetProperty("currency", out var curr) 
                    ? curr.GetString() : "USD"
            }
        };
        
        if (requestBody.TryGetProperty("note", out var note))
            refundPayload["note_to_payer"] = note.GetString();
        
        if (requestBody.TryGetProperty("invoiceId", out var invoiceId))
            refundPayload["invoice_id"] = invoiceId.GetString();
        
        var request = new HttpRequestMessage(HttpMethod.Post, 
            $"{_paypalBase}/v2/payments/captures/{captureId}/refund");
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", accessToken);
        request.Headers.Add("PayPal-Request-Id", Guid.NewGuid().ToString());
        request.Content = new StringContent(
            JsonSerializer.Serialize(refundPayload),
            Encoding.UTF8,
            "application/json"
        );
        
        var response = await _httpClient.SendAsync(request);
        var content = await response.Content.ReadAsStringAsync();
        var refundData = JsonSerializer.Deserialize<JsonElement>(content);
        
        return Ok(new
        {
            refundId = refundData.GetProperty("id").GetString(),
            status = refundData.GetProperty("status").GetString(),
            amount = refundData.GetProperty("amount"),
            details = refundData
        });
    }
    catch
    {
        return StatusCode(500, new { error = "REFUND_FAILED" });
    }
}
```

#### Get Refund Details

```csharp
[HttpGet("payments/refunds/{refundId}")]
public async Task<IActionResult> GetRefundDetails(string refundId)
{
    try
    {
        var accessToken = await _tokenController.GetAccessToken();
        
        var request = new HttpRequestMessage(HttpMethod.Get, 
            $"{_paypalBase}/v2/payments/refunds/{refundId}");
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

#### Get Order Details for Refund

```csharp
[HttpGet("checkout/orders/{orderId}/details")]
public async Task<IActionResult> GetOrderDetailsForRefund(string orderId)
{
    try
    {
        var accessToken = await _tokenController.GetAccessToken();
        
        var request = new HttpRequestMessage(HttpMethod.Get, 
            $"{_paypalBase}/v2/checkout/orders/{orderId}");
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", accessToken);
        
        var response = await _httpClient.SendAsync(request);
        var content = await response.Content.ReadAsStringAsync();
        var orderData = JsonSerializer.Deserialize<JsonElement>(content);
        
        string captureId = null;
        if (orderData.GetProperty("purchase_units")[0]
            .TryGetProperty("payments", out var payments) &&
            payments.TryGetProperty("captures", out var captures) &&
            captures.GetArrayLength() > 0)
        {
            captureId = captures[0].GetProperty("id").GetString();
        }
        
        return Ok(new
        {
            orderId,
            captureId,
            status = orderData.GetProperty("status").GetString(),
            details = orderData
        });
    }
    catch
    {
        return StatusCode(500, new { error = "FETCH_FAILED" });
    }
}
```

