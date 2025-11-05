#### List all balances

```csharp
public static async Task<dynamic?> ListAllBalancesAsync()
{
    try
    {
        var accessToken = await GetAccessTokenAsync();
        var request = new HttpRequestMessage(HttpMethod.Get, $"{BaseUrl}/v1/reporting/balances");
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

> Note:When *RETURNALLCURRENCIES=0* in NVP, or *<ebl:ReturnAllCurrencies>false</ebl:ReturnAllCurrencies>* in SOAP, omit *currency_code* (or set it to your primary currency, e.g., USD).
