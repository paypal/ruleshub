#### Create Order with Vault Directive

```csharp
using Microsoft.AspNetCore.Mvc;
using System.Net.Http;
using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;

[HttpPost("create-with-vault")]
public async Task<IActionResult> CreateOrderWithVault([FromBody] JsonElement requestBody)
{
    try
    {
        var accessToken = await _tokenController.GetAccessToken();
        
        var orderPayload = new Dictionary<string, object>
        {
            ["intent"] = "CAPTURE",
            ["purchase_units"] = new[]
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
        
        if (requestBody.TryGetProperty("saveCard", out var saveCard) && saveCard.GetBoolean())
        {
            orderPayload["payment_source"] = new
            {
                card = new
                {
                    attributes = new
                    {
                        verification = new { method = "SCA_WHEN_REQUIRED" },
                        vault = new
                        {
                            store_in_vault = "ON_SUCCESS",
                            usage_type = "MERCHANT",
                            customer_type = "CONSUMER",
                            permit_multiple_payment_tokens = true
                        }
                    }
                }
            };
        }
        
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

#### Create Order with Vault ID

```csharp
[HttpPost("create-with-vault-id")]
public async Task<IActionResult> CreateOrderWithVaultId([FromBody] JsonElement requestBody)
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
                    vault_id = requestBody.GetProperty("vaultId").GetString()
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
        
        var captureRequest = new HttpRequestMessage(HttpMethod.Post, 
            $"{_paypalBase}/v2/checkout/orders/{orderData.GetProperty("id").GetString()}/capture");
        captureRequest.Headers.Authorization = new AuthenticationHeaderValue("Bearer", accessToken);
        captureRequest.Headers.Add("PayPal-Request-Id", Guid.NewGuid().ToString());
        captureRequest.Content = new StringContent("{}", Encoding.UTF8, "application/json");
        
        var captureResponse = await _httpClient.SendAsync(captureRequest);
        var captureContent = await captureResponse.Content.ReadAsStringAsync();
        
        return Ok(JsonSerializer.Deserialize<object>(captureContent));
    }
    catch
    {
        return StatusCode(500, new { error = "PAYMENT_FAILED" });
    }
}
```

#### List Payment Tokens

```csharp
[HttpGet("vault/payment-tokens")]
public async Task<IActionResult> ListPaymentTokens([FromQuery] string customerId)
{
    try
    {
        var accessToken = await _tokenController.GetAccessToken();
        
        var request = new HttpRequestMessage(HttpMethod.Get, 
            $"{_paypalBase}/v3/vault/payment-tokens?customer_id={customerId}");
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

#### Delete Payment Token

```csharp
[HttpDelete("vault/payment-tokens/{tokenId}")]
public async Task<IActionResult> DeletePaymentToken(string tokenId)
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
            return Ok(new { success = true, message = "Card deleted successfully" });
        }
        
        return StatusCode((int)response.StatusCode, new { success = false });
    }
    catch
    {
        return StatusCode(500, new { error = "DELETE_FAILED" });
    }
}
```

