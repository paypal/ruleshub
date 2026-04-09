#### Void an authorization

> Note: A status code of 204 is returned when the **Prefer** header is set to *return=minimal* (default behavior).
> A status code of 200 is returned when the **Prefer** header is set to *return=representation*. 

```csharp
public static async Task<bool> VoidAuthAsync(string authorizationId)
{
    try
    {
        var accessToken = await GetAccessTokenAsync();
        var request = new HttpRequestMessage(HttpMethod.Post, $"{BaseUrl}/v2/payments/authorizations/{authorizationId}/void");
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", accessToken);
        request.Headers.Add("PayPal-Request-Id", Guid.NewGuid().ToString());
        request.Content = new StringContent("{}", Encoding.UTF8, "application/json");
        var response = await HttpClient.SendAsync(request);
        if (!response.IsSuccessStatusCode)
        {
            var responseBody = await response.Content.ReadAsStringAsync();
            var errorResponse = JsonConvert.DeserializeObject<dynamic>(responseBody);
            var debugId = errorResponse?.debug_id?.ToString();
            Console.WriteLine($"Error debug id: {debugId}");
            throw new HttpRequestException($"Request failed with status code {response.StatusCode}");
        }
        return response.IsSuccessStatusCode;
    }
    catch (Exception e)
    {
        Console.WriteLine($"Error: {e.Message}");
        throw;
    }
}
```