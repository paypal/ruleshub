#### Show user profile details

```csharp
public static async Task<dynamic?> GetUserInfoAsync()
{
    try
    {
        var accessToken = await GetAccessTokenAsync();
        var request = new HttpRequestMessage(HttpMethod.Get, $"{BaseUrl}/v1/identity/openidconnect/userinfo?schema=openid");
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", accessToken);
        var response = await HttpClient.SendAsync(request);
        var responseBody = await response.Content.ReadAsStringAsync();
        if (!response.IsSuccessStatusCode)
        {
            var errorResponse = JsonConvert.DeserializeObject<dynamic>(responseBody);
            var debugId = errorResponse?.debug_id?.ToString();
            Console.WriteLine($"Error debug id: {debugId}");
            throw new HttpRequestException($"Request failed with status code {response.StatusCode}");
        }
        return JsonConvert.DeserializeObject<dynamic>(responseBody) ?? throw new InvalidOperationException("Failed to deserialize response");
    }
    catch (Exception e)
    {
        Console.WriteLine($"Error: {e.Message}");
        throw;
    }
}
```