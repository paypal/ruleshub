#### Enhanced Error Handling with Debug IDs

```csharp
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Logging;
using System.Net.Http;
using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;

[HttpPost("create-with-error-handling")]
public async Task<IActionResult> CreateOrderWithErrorHandling(
    [FromBody] JsonElement requestBody,
    [FromServices] ILogger<PayPalOrderController> logger)
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
        
        if (response.IsSuccessStatusCode)
        {
            return Ok(JsonSerializer.Deserialize<object>(content));
        }
        
        var debugId = response.Headers.TryGetValues("PayPal-Debug-Id", out var values) 
            ? values.FirstOrDefault() : "N/A";
        var errorData = JsonSerializer.Deserialize<JsonElement>(content);
        
        logger.LogError($"Order creation failed - Debug ID: {debugId}");
        logger.LogError($"Status: {(int)response.StatusCode}");
        logger.LogError($"Error: {content}");
        
        return StatusCode((int)response.StatusCode, new
        {
            error = "ORDER_CREATION_FAILED",
            debugId,
            status = (int)response.StatusCode,
            details = errorData.TryGetProperty("details", out var det) ? det : default,
            message = errorData.TryGetProperty("message", out var msg) 
                ? msg.GetString() : "Failed to create order"
        });
    }
    catch (Exception ex)
    {
        logger.LogError($"Unexpected error: {ex.Message}");
        return StatusCode(500, new
        {
            error = "INTERNAL_ERROR",
            message = "An unexpected error occurred"
        });
    }
}
```

#### Error Handler Utility Class

```csharp
public class PayPalErrorHandler
{
    private readonly ILogger<PayPalErrorHandler> _logger;

    public PayPalErrorHandler(ILogger<PayPalErrorHandler> logger)
    {
        _logger = logger;
    }

    public async Task<object> HandleError(HttpResponseMessage response)
    {
        var debugId = response.Headers.TryGetValues("PayPal-Debug-Id", out var values) 
            ? values.FirstOrDefault() : "N/A";
        var content = await response.Content.ReadAsStringAsync();
        var errorData = JsonSerializer.Deserialize<JsonElement>(content);
        
        _logger.LogError($"PayPal API Error - Debug ID: {debugId}");
        _logger.LogError($"Status: {(int)response.StatusCode}");
        _logger.LogError($"Details: {content}");
        
        return new
        {
            error = errorData.TryGetProperty("name", out var name) ? name.GetString() : "API_ERROR",
            debugId,
            message = errorData.TryGetProperty("message", out var msg) 
                ? msg.GetString() : "PayPal API error",
            details = errorData.TryGetProperty("details", out var det) ? det : default
        };
    }
}
```

#### Specific Error Handlers

```csharp
public static class PayPalErrorUtils
{
    public static object HandleValidationError(JsonElement errorData, string debugId)
    {
        var fieldErrors = new List<object>();
        
        if (errorData.TryGetProperty("details", out var details))
        {
            foreach (var detail in details.EnumerateArray())
            {
                fieldErrors.Add(new
                {
                    field = detail.TryGetProperty("field", out var f) ? f.GetString() : null,
                    issue = detail.TryGetProperty("issue", out var i) ? i.GetString() : null,
                    description = detail.TryGetProperty("description", out var d) ? d.GetString() : null
                });
            }
        }
        
        return new
        {
            error = "VALIDATION_ERROR",
            debugId,
            message = "Invalid request data",
            fieldErrors
        };
    }

    public static object HandleAuthenticationError(string debugId)
    {
        return new
        {
            error = "AUTHENTICATION_FAILED",
            debugId,
            message = "Invalid or expired credentials"
        };
    }

    public static object HandlePaymentError(JsonElement errorData, string debugId)
    {
        var errorName = errorData.TryGetProperty("name", out var name) ? name.GetString() : "";
        var userMessage = "Payment could not be processed";
        
        if (errorName.Contains("INSTRUMENT_DECLINED"))
        {
            userMessage = "Payment method was declined. Please try another payment method.";
        }
        else if (errorName.Contains("INSUFFICIENT_FUNDS"))
        {
            userMessage = "Insufficient funds. Please try another payment method.";
        }
        else if (errorName.Contains("ORDER_NOT_APPROVED"))
        {
            userMessage = "Order was not approved. Please try again.";
        }
        
        return new
        {
            error = errorName,
            debugId,
            message = userMessage,
            details = errorData.TryGetProperty("details", out var det) ? det : default
        };
    }
}
```

#### Error Logger

```csharp
public static class PayPalErrorLogger
{
    public static void LogError(
        ILogger logger,
        string operation,
        string debugId,
        int statusCode,
        JsonElement errorData,
        object requestData = null)
    {
        logger.LogError("PayPal API Error:");
        logger.LogError($"  Operation: {operation}");
        logger.LogError($"  Debug ID: {debugId}");
        logger.LogError($"  Status Code: {statusCode}");
        logger.LogError($"  Error Name: {(errorData.TryGetProperty("name", out var n) ? n.GetString() : "N/A")}");
        logger.LogError($"  Error Message: {(errorData.TryGetProperty("message", out var m) ? m.GetString() : "N/A")}");
        
        if (requestData != null)
        {
            logger.LogError($"  Request Data: {JsonSerializer.Serialize(requestData)}");
        }
    }
}
```

