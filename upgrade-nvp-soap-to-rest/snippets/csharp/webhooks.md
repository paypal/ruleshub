#### Setting up webhook for persisting vaulted payment source id

> To learn more, refer to [Create Webhook](https://developer.paypal.com/docs/api/webhooks/v1/#webhooks_post) and [List webhooks](https://developer.paypal.com/docs/api/webhooks/v1/#webhooks_list).

```csharp
// List all webhooks available
public static async Task<dynamic?> ListWebhooksAsync()
{
    try
    {
        var accessToken = await GetAccessTokenAsync();
        var request = new HttpRequestMessage(HttpMethod.Get, $"{BaseUrl}/v1/notifications/webhooks");
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

public static async Task<dynamic?> CreateWebhookAsync(string webhookUrl)
{
    try
    {
        var accessToken = await GetAccessTokenAsync();
        // First, check if webhook already exists
        var existingWebhooks = await ListWebhooksAsync();
        if (existingWebhooks?.webhooks != null)
        {
            foreach (var webhook in existingWebhooks.webhooks)
            {
                if (webhook?.url?.ToString() == webhookUrl)
                {
                    return webhook;
                }
            }
        }
        string createWebhookUrl = $"{BaseUrl}/v1/notifications/webhooks";
        var payload = new
        {
            url = webhookUrl,
            event_types = new[]
            {
                new { name = "VAULT.PAYMENT-TOKEN.CREATED" }
            }
        };
        var request = new HttpRequestMessage(HttpMethod.Post, createWebhookUrl)
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
        return JsonConvert.DeserializeObject<dynamic>(responseBody) ?? throw new InvalidOperationException("Failed to deserialize response");
    }
    catch (Exception e)
    {
        Console.WriteLine($"Error: {e.Message}");
        throw;
    }
}
```

#### Webhook signature verification

> To learn more, refer to [Verify Webhook Signatures](https://developer.paypal.com/docs/api/webhooks/v1/#verify-webhook-signature_post).

```csharp
public static async Task<bool> VerifyWebhookSignatureAsync(string webhookId, Dictionary<string, string> headers, string body)
{
    try
    {
        var accessToken = await GetAccessTokenAsync();
        var verificationData = new
        {
            auth_algo = headers.GetValueOrDefault("paypal-auth-algo"),
            cert_url = headers.GetValueOrDefault("paypal-cert-url"),
            transmission_id = headers.GetValueOrDefault("paypal-transmission-id"),
            transmission_sig = headers.GetValueOrDefault("paypal-transmission-sig"),
            transmission_time = headers.GetValueOrDefault("paypal-transmission-time"),
            webhook_id = webhookId,
            webhook_event = JsonConvert.DeserializeObject(body)
        };
        var request = new HttpRequestMessage(HttpMethod.Post, $"{BaseUrl}/v1/notifications/verify-webhook-signature")
        {
            Content = new StringContent(JsonConvert.SerializeObject(verificationData), Encoding.UTF8, "application/json")
        };
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
        var result = JsonConvert.DeserializeObject<dynamic>(responseBody);
        return result?.verification_status?.ToString() == "SUCCESS";
    }
    catch (Exception e)
    {
        Console.WriteLine($"Error: {e.Message}");
        throw;
    }
}
```

#### Webhook handler to capture and store "VaultId" from the event data

> To learn more, refer to [Show event notification details](https://developer.paypal.com/docs/api/webhooks/v1/#webhooks-events_get).

```csharp
public static async Task<string?> WebhookHandlerAsync(string webhookId, Dictionary<string, string> headers, string body)
{
    try
    {
        var isVerified = await VerifyWebhookSignatureAsync(webhookId, headers, body);
        if (!isVerified)
        {
            throw new InvalidOperationException("Webhook verification failed");
        }
        var eventData = JsonConvert.DeserializeObject<dynamic>(body);
        if (eventData?.event_type?.ToString() == "VAULT.PAYMENT-TOKEN.CREATED")
        {
            // This is the unique identifier associated with the customer's payment source stored in the PayPal Vault.
            // This "vaultId" can be used to make future payments without needing customer's consent.
            var vaultId = eventData?.resource?.id?.ToString();
            // TODO: Save the vaultId to the database.
            return vaultId;
        }
        throw new InvalidOperationException("Invalid webhook event");
    }
    catch (Exception e)
    {
        Console.WriteLine($"Error: {e.Message}");
        throw;
    }
}
```