#### Refund the captured amount

> Send an empty request body to initiate a refund for the amount equal to [captured amount – refunds already issued].

```csharp
public static async Task<string> RefundTransactionAsync(string transactionId)
{
    try
    {
        var accessToken = await GetAccessTokenAsync();
        var request = new HttpRequestMessage(HttpMethod.Post, $"{BaseUrl}/v2/payments/captures/{transactionId}/refund");
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", accessToken);
        request.Headers.Add("PayPal-Request-Id", Guid.NewGuid().ToString());
        request.Content = new StringContent("{}", Encoding.UTF8, "application/json");
        var response = await HttpClient.SendAsync(request);
        var responseBody = await response.Content.ReadAsStringAsync();
        if (!response.IsSuccessStatusCode)
        {
            var errorResponse = JsonConvert.DeserializeObject<dynamic>(responseBody);
            var debugId = errorResponse?.debug_id?.ToString();
            Console.WriteLine($"Error debug id: {debugId}");
            throw new HttpRequestException($"Request failed with status code {response.StatusCode}");
        }
        var jsonResponse = JsonConvert.DeserializeObject<dynamic>(responseBody);
        return jsonResponse?.id ?? throw new InvalidOperationException("Refund ID not found in response");
    }
    catch (Exception e)
    {
        Console.WriteLine($"Error: {e.Message}");
        throw;
    }
}
```

#### Refund specific amount

> Include the specific amount in the request body to initiate a refund for that amount against the capture.

```csharp
public static async Task<string> RefundTransactionPartialAsync(string transactionId, string amount)
{
    try
    {
        var accessToken = await GetAccessTokenAsync();
        var request = new HttpRequestMessage(HttpMethod.Post, $"{BaseUrl}/v2/payments/captures/{transactionId}/refund");
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", accessToken);
        request.Headers.Add("PayPal-Request-Id", Guid.NewGuid().ToString());
        var payload = new
        {
            amount = new
            {
                currency_code = "USD", // Legacy equivalents — NVP: CURRENCYCODE ; SOAP: Amount.currencyID
                value = amount // Legacy equivalents — NVP: AMT ; SOAP: Amount
            }
        };
        request.Content = new StringContent(JsonConvert.SerializeObject(payload), Encoding.UTF8, "application/json");
        var response = await HttpClient.SendAsync(request);
        var responseBody = await response.Content.ReadAsStringAsync();
        if (!response.IsSuccessStatusCode)
        {
            var errorResponse = JsonConvert.DeserializeObject<dynamic>(responseBody);
            var debugId = errorResponse?.debug_id?.ToString();
            Console.WriteLine($"Error debug id: {debugId}");
            throw new HttpRequestException($"Request failed with status code {response.StatusCode}");
        }
        var jsonResponse = JsonConvert.DeserializeObject<dynamic>(responseBody);
        return jsonResponse?.id ?? throw new InvalidOperationException("Refund ID not found in response");
    }
    catch (Exception e)
    {
        Console.WriteLine($"Error: {e.Message}");
        throw;
    }
}
```