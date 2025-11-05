#### OAuth2.0 Authentication

```csharp
static readonly ConcurrentDictionary<string, TokenCacheEntry> TokenCache = new ConcurrentDictionary<string, TokenCacheEntry>();
private class TokenCacheEntry
{
    public string AccessToken { get; set; } = "";
    public DateTime ExpiresAt { get; set; }
}

public static async Task<string> GetAccessTokenAsync()
{
    try
    {
        if (TokenCache.TryGetValue("access_token", out var cachedToken) && cachedToken.ExpiresAt > DateTime.UtcNow)
        {
            return cachedToken.AccessToken;
        }
        var clientId = Environment.GetEnvironmentVariable("PAYPAL_CLIENT_ID");
        var clientSecret = Environment.GetEnvironmentVariable("PAYPAL_CLIENT_SECRET");
        var auth = Convert.ToBase64String(Encoding.UTF8.GetBytes($"{clientId}:{clientSecret}"));
        var request = new HttpRequestMessage(HttpMethod.Post, $"{BaseUrl}/v1/oauth2/token");
        request.Headers.Authorization = new AuthenticationHeaderValue("Basic", auth);
        request.Headers.Add("PayPal-Request-Id", Guid.NewGuid().ToString());
        request.Content = new StringContent("grant_type=client_credentials", Encoding.UTF8, "application/x-www-form-urlencoded");
        var response = await HttpClient.SendAsync(request);
        if (!response.IsSuccessStatusCode)
        {
            var responseBody = await response.Content.ReadAsStringAsync();
            var errorResponse = JsonConvert.DeserializeObject<dynamic>(responseBody);
            var debugId = errorResponse?.debug_id?.ToString();
            Console.WriteLine($"Error debug id: {debugId}");
            throw new HttpRequestException($"Request failed with status code {response.StatusCode}");
        }
        response.EnsureSuccessStatusCode();
        var successResponseBody = await response.Content.ReadAsStringAsync();
        var tokenResponse = JsonConvert.DeserializeObject<dynamic>(successResponseBody);
        var newCacheEntry = new TokenCacheEntry
        {
            AccessToken = tokenResponse?.access_token ?? throw new InvalidOperationException("Access token not found in response"),
            ExpiresAt = DateTime.UtcNow.AddSeconds((double)tokenResponse.expires_in).AddMinutes(-1) // 1 minute buffer
        };
        TokenCache["access_token"] = newCacheEntry;
        return newCacheEntry.AccessToken;
    }
    catch (Exception e)
    {
        Console.WriteLine($"Error: {e.Message}");
        throw;
    }
}
```