#### Capturing full authorized amount

> Use the capture authorization endpoint with an empty request body to capture the entire authorized amount and treat it as the final capture.

```csharp
public static async Task<string> CaptureAuthorizationAsync(string authorizationId)
{
    try
    {
        var accessToken = await GetAccessTokenAsync();
        var request = new HttpRequestMessage(HttpMethod.Post, $"{BaseUrl}/v2/payments/authorizations/{authorizationId}/capture");
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
        return jsonResponse?.id ?? throw new InvalidOperationException("Capture ID not found in response");
    }
    catch (Exception e)
    {
        Console.WriteLine($"Error: {e.Message}");
        throw;
    }
}
```

#### Capturing part of the authorized amount

> For partial captures, specify amount to be captured and set "final_capture" explicitly to false.

```csharp
public static async Task<string> CaptureAuthorizationPartialAsync(string authorizationId, string amount, bool finalCapture = true)
{
    try
    {
        var accessToken = await GetAccessTokenAsync();
        var request = new HttpRequestMessage(HttpMethod.Post, $"{BaseUrl}/v2/payments/authorizations/{authorizationId}/capture");
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", accessToken);
        request.Headers.Add("PayPal-Request-Id", Guid.NewGuid().ToString());
        var payload = new
        {
            amount = new
            {
                currency_code = "USD", // Legacy equivalents — NVP: CURRENCYCODE; SOAP: Amount.currencyID
                value = amount // Legacy equivalents — NVP: AMT; SOAP: Amount
            },
            final_capture = finalCapture // Legacy equivalents — NVP: COMPLETETYPE; SOAP: CompleteType
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
        return jsonResponse?.id ?? throw new InvalidOperationException("Capture ID not found in response"); // Returns the ID assigned for the captured payment.
    }
    catch (Exception e)
    {
        Console.WriteLine($"Error: {e.Message}");
        throw;
    }
}
```