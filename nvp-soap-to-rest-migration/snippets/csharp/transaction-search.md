#### Finding Transactions with TransactionID (legacy `GetTransactionDetails`)

```csharp
public static async Task<dynamic?> ViewTransactionAsync(string transactionId)
{
    try
    {
        var accessToken = await GetAccessTokenAsync();
        var now = DateTime.UtcNow;
        var startTime = now.AddDays(-7);
        var endTime = now.AddDays(-1);
        var uriBuilder = new UriBuilder($"{BaseUrl}/v1/reporting/transactions");
        var query = HttpUtility.ParseQueryString(uriBuilder.Query);
        query["start_date"] = startTime.ToString("yyyy-MM-ddTHH:mm:ss.fffZ"); // Legacy equivalents — NVP: STARTDATE ; SOAP: StartDate
        query["end_date"] = endTime.ToString("yyyy-MM-ddTHH:mm:ss.fffZ"); // Legacy equivalents — NVP: ENDDATE ; SOAP: EndDate
        query["transaction_id"] = transactionId; // Legacy equivalents — NVP: TRANSACTIONID ; SOAP: TransactionID
        uriBuilder.Query = query.ToString();
        var request = new HttpRequestMessage(HttpMethod.Get, uriBuilder.ToString());
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

#### Searching Transactions between a start date and end date (legacy `TransactionSearch`)

```csharp
public static async Task<dynamic?> SearchTransactionsAsync()
{
    try
    {
        var accessToken = await GetAccessTokenAsync();
        var now = DateTime.UtcNow;
        var startTime = now.AddDays(-7);
        var endTime = now.AddDays(-1);
        var uriBuilder = new UriBuilder($"{BaseUrl}/v1/reporting/transactions");
        var query = HttpUtility.ParseQueryString(uriBuilder.Query);
        query["start_date"] = startTime.ToString("yyyy-MM-ddTHH:mm:ss.fffZ"); // Legacy equivalents — NVP: STARTDATE ; SOAP: StartDate
        query["end_date"] = endTime.ToString("yyyy-MM-ddTHH:mm:ss.fffZ"); // Legacy equivalents — NVP: ENDDATE ; SOAP: EndDate
        uriBuilder.Query = query.ToString();
        var request = new HttpRequestMessage(HttpMethod.Get, uriBuilder.ToString());
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