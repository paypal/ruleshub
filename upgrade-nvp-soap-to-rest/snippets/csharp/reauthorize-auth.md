#### Reauthorizing the full amount that was authorized before

> Note: Sending a reauthorization request with an empty body will reauthorize the full amount of the previously authorized order.

```csharp
// The authorizationId parameter must be the original identifier returned when the order was first authorized.
public static async Task<string> ReauthorizeAuthAsync(string authorizationId)
{
    try
    {
        var accessToken = await GetAccessTokenAsync();
        var request = new HttpRequestMessage(HttpMethod.Post, $"{BaseUrl}/v2/payments/authorizations/{authorizationId}/reauthorize");
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
        return jsonResponse?.id ?? throw new InvalidOperationException("Reauthorization ID not found in response");
    }
    catch (Exception e)
    {
        Console.WriteLine($"Error: {e.Message}");
        throw;
    }
}
```

#### Reauthorizing part of the amount that was authorized before

> Note: Include the amount field in the reauthorization request body to reauthorize a specific amount, which must not exceed the originally authorized value.

```csharp
public static async Task<string> ReauthorizeAuthPartialAsync(string authorizationId, string amount)
{
    try
    {
        var accessToken = await GetAccessTokenAsync();
        var request = new HttpRequestMessage(HttpMethod.Post, $"{BaseUrl}/v2/payments/authorizations/{authorizationId}/reauthorize");
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", accessToken);
        request.Headers.Add("PayPal-Request-Id", Guid.NewGuid().ToString());
        var payload = new
        {
            amount = new
            {
                currency_code = "USD", // Legacy equivalents — NVP: CURRENCYCODE; SOAP: Not Supported
                value = amount // Legacy equivalents — NVP: AMT; SOAP: Amount
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
        return jsonResponse?.id ?? throw new InvalidOperationException("Reauthorization ID not found in response"); // ID for the reauthorized authorization.
    }
    catch (Exception e)
    {
        Console.WriteLine($"Error: {e.Message}");
        throw;
    }
}
```