#### Create a new setup token

```csharp
public static async Task<CreateSetupTokenResult> CreateSetupTokenAsync()
{
    try
    {
        var accessToken = await GetAccessTokenAsync();
        string createSetupTokenUrl = $"{BaseUrl}/v3/vault/setup-tokens";
        var payload = new
        {
            payment_source = new
            {
                paypal = new
                {
                    usage_pattern = "IMMEDIATE", // Only available in REST APIs
                    usage_type = "MERCHANT", // Only available in REST APIs
                    experience_context = new
                    {
                        return_url = "https://example.com/return", // Legacy equivalents — NVP: RETURNURL; SOAP: ReturnURL
                        cancel_url = "https://example.com/cancel", // Legacy equivalents — NVP: CANCELURL; SOAP: CancelURL
                        shipping_preference = "SET_PROVIDED_ADDRESS", // Legacy equivalents — NVP: ADDROVERRIDE; SOAP: AddressOverride
                        brand_name = "Example Store", // Legacy equivalents — NVP: BRANDNAME; SOAP: BrandName
                        locale = "en-US" // Legacy equivalents — NVP: LOCALECODE; SOAP: LocaleCode
                    }
                }
            }
        };
        var request = new HttpRequestMessage(HttpMethod.Post, createSetupTokenUrl)
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
        var jsonResponse = JObject.Parse(responseBody);
        var setupTokenId = jsonResponse["id"]?.ToString();
        var approvalUrl = jsonResponse["links"]
            ?.FirstOrDefault(l => l["rel"]?.ToString() == "approve")
            ?["href"]?.ToString();
        return new CreateSetupTokenResult { SetupTokenId = setupTokenId, ApprovalUrl = approvalUrl };
    }
    catch (Exception e)
    {
        Console.WriteLine($"Error: {e.Message}");
        throw;
    }
}
```