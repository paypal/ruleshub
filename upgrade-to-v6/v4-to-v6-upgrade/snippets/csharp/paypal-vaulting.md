#### Create Setup Token (Save PayPal Without Purchase)

```csharp
using Microsoft.AspNetCore.Mvc;
using System.Net.Http;
using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;

[HttpPost("vault/setup-token/create")]
public async Task<IActionResult> CreateSetupToken()
{
    try
    {
        var accessToken = await _tokenController.GetAccessToken();
        
        var setupTokenPayload = new
        {
            payment_source = new
            {
                paypal = new
                {
                    usage_type = "MERCHANT",
                    customer_type = "CONSUMER",
                    permit_multiple_payment_tokens = true
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
        var setupData = JsonSerializer.Deserialize<JsonElement>(content);
        
        return Ok(new
        {
            id = setupData.GetProperty("id").GetString(),
            status = setupData.GetProperty("status").GetString()
        });
    }
    catch
    {
        return StatusCode(500, new { error = "SETUP_TOKEN_FAILED" });
    }
}
```

#### Create Payment Token from Setup Token

```csharp
[HttpPost("vault/payment-token/create")]
public async Task<IActionResult> CreatePaymentToken([FromBody] JsonElement requestBody)
{
    try
    {
        var accessToken = await _tokenController.GetAccessToken();
        
        var paymentTokenPayload = new
        {
            payment_source = new
            {
                token = new
                {
                    id = requestBody.GetProperty("vaultSetupToken").GetString(),
                    type = "SETUP_TOKEN"
                }
            }
        };
        
        var request = new HttpRequestMessage(HttpMethod.Post, $"{_paypalBase}/v3/vault/payment-tokens");
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", accessToken);
        request.Headers.Add("PayPal-Request-Id", Guid.NewGuid().ToString());
        request.Content = new StringContent(
            JsonSerializer.Serialize(paymentTokenPayload),
            Encoding.UTF8,
            "application/json"
        );
        
        var response = await _httpClient.SendAsync(request);
        var content = await response.Content.ReadAsStringAsync();
        var tokenData = JsonSerializer.Deserialize<JsonElement>(content);
        
        return Ok(new
        {
            id = tokenData.GetProperty("id").GetString(),
            customerId = tokenData.GetProperty("customer").GetProperty("id").GetString(),
            status = "saved"
        });
    }
    catch
    {
        return StatusCode(500, new { error = "PAYMENT_TOKEN_FAILED" });
    }
}
```

#### Create Order with Saved PayPal

```csharp
[HttpPost("create-with-payment-token")]
public async Task<IActionResult> CreateOrderWithPaymentToken([FromBody] JsonElement requestBody)
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
                paypal = new
                {
                    vault_id = requestBody.GetProperty("paymentTokenId").GetString()
                }
            }
        };
        
        var createRequest = new HttpRequestMessage(HttpMethod.Post, $"{_paypalBase}/v2/checkout/orders");
        createRequest.Headers.Authorization = new AuthenticationHeaderValue("Bearer", accessToken);
        createRequest.Headers.Add("PayPal-Request-Id", Guid.NewGuid().ToString());
        createRequest.Content = new StringContent(
            JsonSerializer.Serialize(orderPayload),
            Encoding.UTF8,
            "application/json"
        );
        
        var createResponse = await _httpClient.SendAsync(createRequest);
        var orderContent = await createResponse.Content.ReadAsStringAsync();
        var orderData = JsonSerializer.Deserialize<JsonElement>(orderContent);
        
        if (orderData.GetProperty("status").GetString() == "CREATED")
        {
            var captureRequest = new HttpRequestMessage(HttpMethod.Post,
                $"{_paypalBase}/v2/checkout/orders/{orderData.GetProperty("id").GetString()}/capture");
            captureRequest.Headers.Authorization = new AuthenticationHeaderValue("Bearer", accessToken);
            captureRequest.Headers.Add("PayPal-Request-Id", Guid.NewGuid().ToString());
            captureRequest.Content = new StringContent("{}", Encoding.UTF8, "application/json");
            
            var captureResponse = await _httpClient.SendAsync(captureRequest);
            var captureContent = await captureResponse.Content.ReadAsStringAsync();
            return Ok(JsonSerializer.Deserialize<object>(captureContent));
        }
        
        return Ok(orderData);
    }
    catch
    {
        return StatusCode(500, new { error = "ORDER_FAILED" });
    }
}
```

#### List Saved Payment Methods

```csharp
[HttpGet("customer/payment-methods")]
public async Task<IActionResult> ListPaymentMethods([FromQuery] string customerId)
{
    try
    {
        var accessToken = await _tokenController.GetAccessToken();
        
        var request = new HttpRequestMessage(HttpMethod.Get,
            $"{_paypalBase}/v3/vault/payment-tokens?customer_id={customerId}");
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", accessToken);
        
        var response = await _httpClient.SendAsync(request);
        var content = await response.Content.ReadAsStringAsync();
        var tokensData = JsonSerializer.Deserialize<JsonElement>(content);
        
        var paymentTokens = tokensData.TryGetProperty("payment_tokens", out var tokens) 
            ? tokens : default;
        
        return Ok(new
        {
            payment_tokens = paymentTokens,
            total_items = paymentTokens.ValueKind == JsonValueKind.Array ? paymentTokens.GetArrayLength() : 0
        });
    }
    catch
    {
        return StatusCode(500, new { error = "FETCH_FAILED" });
    }
}
```

#### Delete Saved Payment Method

```csharp
[HttpDelete("vault/payment-tokens/{tokenId}")]
public async Task<IActionResult> DeletePaymentMethod(string tokenId)
{
    try
    {
        var accessToken = await _tokenController.GetAccessToken();
        
        var request = new HttpRequestMessage(HttpMethod.Delete,
            $"{_paypalBase}/v3/vault/payment-tokens/{tokenId}");
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", accessToken);
        
        var response = await _httpClient.SendAsync(request);
        
        if (response.StatusCode == System.Net.HttpStatusCode.NoContent)
        {
            return Ok(new { success = true, message = "Payment method deleted" });
        }
        
        return StatusCode((int)response.StatusCode, new { success = false });
    }
    catch
    {
        return StatusCode(500, new { error = "DELETE_FAILED" });
    }
}
```

