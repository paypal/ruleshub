#### Creating a "CAPTURE" order with vaulted Payment

```csharp
public static async Task<dynamic?> CaptureReferenceTransactionAsync(string vaultId, string amount, string currencyCode)
{
    try
    {
        var accessToken = await GetAccessTokenAsync();
        string createOrderUrl = $"{BaseUrl}/v2/checkout/orders";
        var payload = new
        {
            intent = "CAPTURE", // Legacy equivalents — NVP: PAYMENTACTION ; SOAP: PaymentAction
            purchase_units = new[]
            {
                new
                {
                    amount = new
                    {
                        currency_code = currencyCode, // Legacy equivalents — NVP: CURRENCYCODE ; SOAP: PaymentDetails.OrderTotal.currencyID
                        value = amount // Legacy equivalents — NVP: AMT ; SOAP: PaymentDetails.OrderTotal
                    }
                }
            },
            payment_source = new
            {
                paypal = new
                {
                    vault_id = vaultId // Used in place of legacy payload's BILLINGAGREEMENTID
                }
            }
        };
        var request = new HttpRequestMessage(HttpMethod.Post, createOrderUrl)
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
        var jsonResponse = JsonConvert.DeserializeObject<dynamic>(responseBody);
        return jsonResponse ?? throw new InvalidOperationException("Failed to deserialize response");
    }
    catch (Exception e)
    {
        Console.WriteLine($"Error: {e.Message}");
        throw;
    }
}
```

#### Creating a "AUTHORIZE" order with vaulted payment

```csharp
public static async Task<dynamic?> AuthorizeAndCaptureReferenceTransactionAsync(string vaultId, string amount, string currencyCode)
{
    try
    {
        var accessToken = await GetAccessTokenAsync();
        string createOrderUrl = $"{BaseUrl}/v2/checkout/orders";
        var payload = new
        {
            intent = "AUTHORIZE", // Legacy equivalents — NVP: PAYMENTACTION ; SOAP: PaymentAction
            purchase_units = new[]
            {
                new
                {
                    amount = new
                    {
                        currency_code = currencyCode, // Legacy equivalents — NVP: CURRENCYCODE ; SOAP: PaymentDetails.OrderTotal.currencyID
                        value = amount // Legacy equivalents — NVP: AMT ; SOAP: PaymentDetails.OrderTotal
                    }
                }
            },
            payment_source = new
            {
                paypal = new
                {
                    vault_id = vaultId // Used in place of legacy payload's BILLINGAGREEMENTID
                }
            }
        };
        var request = new HttpRequestMessage(HttpMethod.Post, createOrderUrl)
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
        var jsonResponse = JsonConvert.DeserializeObject<dynamic>(responseBody);
        var authorizationId = jsonResponse?.purchase_units?[0]?.payments?.authorizations?[0]?.id?.ToString();
        var captureId = await CaptureAuthorizationAsync(authorizationId);
        return new { capture_id = captureId };
    }
    catch (Exception e)
    {
        Console.WriteLine($"Error: {e.Message}");
        throw;
    }
}
```