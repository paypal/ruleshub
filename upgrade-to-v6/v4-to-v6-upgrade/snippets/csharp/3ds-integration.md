#### Create Order with 3D Secure (Always)

```csharp
using Microsoft.AspNetCore.Mvc;
using System.Net.Http;
using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;

[HttpPost("create-3ds")]
public async Task<IActionResult> CreateOrderWith3DS([FromBody] JsonElement requestBody)
{
    try
    {
        var accessToken = await _tokenController.GetAccessToken();
        
        var orderPayload = new
        {
            intent = "CAPTURE",
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
            },
            payment_source = new
            {
                card = new
                {
                    attributes = new
                    {
                        verification = new { method = "SCA_ALWAYS" }
                    },
                    experience_context = new
                    {
                        return_url = "https://example.com/returnUrl",
                        cancel_url = "https://example.com/cancelUrl"
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

#### Create Order with SCA When Required

```csharp
[HttpPost("create-sca")]
public async Task<IActionResult> CreateOrderWithSCA([FromBody] JsonElement requestBody)
{
    try
    {
        var accessToken = await _tokenController.GetAccessToken();
        
        var orderPayload = new
        {
            intent = "CAPTURE",
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
            },
            payment_source = new
            {
                card = new
                {
                    attributes = new
                    {
                        verification = new { method = "SCA_WHEN_REQUIRED" }
                    },
                    experience_context = new
                    {
                        return_url = "https://example.com/returnUrl",
                        cancel_url = "https://example.com/cancelUrl"
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

#### Vault Setup Token with 3DS

```csharp
[HttpPost("vault/setup-token-3ds")]
public async Task<IActionResult> CreateVaultSetupTokenWith3DS([FromBody] JsonElement requestBody)
{
    try
    {
        var accessToken = await _tokenController.GetAccessToken();
        
        var setupTokenPayload = new
        {
            payment_source = new
            {
                card = new
                {
                    experience_context = new
                    {
                        return_url = "https://example.com/returnUrl",
                        cancel_url = "https://example.com/cancelUrl"
                    },
                    verification_method = requestBody.TryGetProperty("scaMethod", out var method) 
                        ? method.GetString() : "SCA_WHEN_REQUIRED"
                }
            }
        };
        
        var request = new HttpRequestMessage(HttpMethod.Post, $"{_paypalBase}/v3/vault/setup-tokens");
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", accessToken);
        request.Headers.Add("PayPal-Request-Id", Guid.NewGuid().ToString());
        request.Content = new StringContent(
            JsonSerializer.Serialize(setupTokenPayload),
            Encoding.UTF8,
            "application/json"
        );
        
        var response = await _httpClient.SendAsync(request);
        var content = await response.Content.ReadAsStringAsync();
        
        return Ok(JsonSerializer.Deserialize<object>(content));
    }
    catch
    {
        return StatusCode(500, new { error = "SETUP_TOKEN_FAILED" });
    }
}
```

#### Capture with 3DS Logging

```csharp
using Microsoft.Extensions.Logging;

[HttpPost("{orderId}/capture-3ds")]
public async Task<IActionResult> CaptureWith3DSLogging(string orderId, [FromServices] ILogger<PayPalOrderController> logger)
{
    try
    {
        var accessToken = await _tokenController.GetAccessToken();
        
        var request = new HttpRequestMessage(HttpMethod.Post, 
            $"{_paypalBase}/v2/checkout/orders/{orderId}/capture");
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", accessToken);
        request.Headers.Add("PayPal-Request-Id", Guid.NewGuid().ToString());
        request.Content = new StringContent("{}", Encoding.UTF8, "application/json");
        
        var response = await _httpClient.SendAsync(request);
        var content = await response.Content.ReadAsStringAsync();
        var captureData = JsonSerializer.Deserialize<JsonElement>(content);
        
        if (captureData.TryGetProperty("payment_source", out var paymentSource) &&
            paymentSource.TryGetProperty("card", out var card) &&
            card.TryGetProperty("authentication_result", out var authResult))
        {
            var threeDS = authResult.TryGetProperty("three_d_secure", out var tds) ? tds : default;
            
            logger.LogInformation("3DS Authentication Result:");
            logger.LogInformation($"  Order ID: {captureData.GetProperty("id").GetString()}");
            logger.LogInformation($"  Liability Shift: {authResult.GetProperty("liability_shift").GetString()}");
            if (threeDS.ValueKind != JsonValueKind.Undefined)
            {
                logger.LogInformation($"  Auth Status: {threeDS.GetProperty("authentication_status").GetString()}");
                logger.LogInformation($"  Enrollment Status: {threeDS.GetProperty("enrollment_status").GetString()}");
            }
        }
        
        return Ok(captureData);
    }
    catch
    {
        return StatusCode(500, new { error = "CAPTURE_FAILED" });
    }
}
```

