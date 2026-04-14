#### Exchanging temporary setup token for a payment token

```csharp
// `setupTokenId` is the setup token created with the `POST /v3/vault/setup-tokens` call.
public static async Task<PaymentToken?> CreatePaymentTokenAsync(string setupTokenId)
{
    try
    {
        var accessToken = await GetAccessTokenAsync();
        string createPaymentTokenUrl = $"{BaseUrl}/v3/vault/payment-tokens";
        var payload = new
        {
            payment_source = new
            {
                token = new
                {
                    id = setupTokenId,
                    type = "SETUP_TOKEN"
                }
            }
        };
        var request = new HttpRequestMessage(HttpMethod.Post, createPaymentTokenUrl)
        {
            Content = new StringContent(JsonConvert.SerializeObject(payload), Encoding.UTF8, "application/json")
        };
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", accessToken);
        request.Headers.Add("PayPal-Request-Id", Guid.NewGuid().ToString());
        var response = await HttpClient.SendAsync(request);
        var responseBody = await response.Content.ReadAsStringAsync();
        if (!response.IsSuccessStatusCode)
        {
            var errorResponse = JsonConvert.DeserializeObject<dynamic>(responseBody);
            var debugId = errorResponse?.debug_id?.ToString();
            Console.WriteLine($"Error debug id: {debugId}");
            throw new HttpRequestException($"Request failed with status code {response.StatusCode}");
        }
        return JsonConvert.DeserializeObject<PaymentToken>(responseBody);
    }
    catch (Exception e)
    {
        Console.WriteLine($"Error: {e.Message}");
        throw;
    }
}
```