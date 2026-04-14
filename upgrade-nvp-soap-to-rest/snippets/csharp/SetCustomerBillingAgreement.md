#### SNIPPET-SetCustomerBA

**Create a setup token for billing agreement (Flow B Migration)**

**Legacy Context:** This replaces the deprecated `SetCustomerBillingAgreement` API (deprecated since version 54.0). The legacy API returned tokens with "RP-" prefix. The modern API returns setup token IDs.

```csharp
public class SetupTokenResponse
{
    public string Id { get; set; }
    public string Status { get; set; }
    public List<Link> Links { get; set; }
    
    public class Link
    {
        public string Href { get; set; }
        public string Rel { get; set; }
    }
}

public static async Task<SetupTokenResponse?> CreateSetupTokenForBillingAgreementAsync()
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
                    description = "Monthly subscription for premium service", // Legacy equivalents — NVP: L_BILLINGAGREEMENTDESCRIPTIONn; SOAP: BillingAgreementDetails.BillingAgreementDescription
                    experience_context = new
                    {
                        return_url = "https://example.com/return", // Legacy equivalents — NVP: RETURNURL; SOAP: ReturnURL
                        cancel_url = "https://example.com/cancel", // Legacy equivalents — NVP: CANCELURL; SOAP: CancelURL
                        locale = "en-US" // Legacy equivalents — NVP: LOCALECODE; SOAP: LocaleCode
                    },
                    usage_pattern = "IMMEDIATE", // Only available in REST APIs
                    usage_type = "MERCHANT" // Only available in REST APIs
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
        
        var setupToken = JsonConvert.DeserializeObject<SetupTokenResponse>(responseBody);
        var approvalUrl = setupToken?.Links?.FirstOrDefault(l => l.Rel == "approve")?.Href;
        
        Console.WriteLine($"Setup Token Created: {setupToken?.Id}");
        Console.WriteLine($"Redirect customer to: {approvalUrl}");
        
        return setupToken;
    }
    catch (Exception e)
    {
        Console.WriteLine($"Error: {e.Message}");
        throw;
    }
}
```

**Migration Notes:**

- **Legacy Fields NOT Supported:**
  - `BILLINGTYPE` / `BillingAgreementDetails.BillingType` -> Handled by vault endpoint structure
  - `PAGESTYLE`, `HDRIMG`, `HDRBACKCOLOR`, 
  - `L_BILLINGAGREEMENTCUSTOMn` -> Custom metadata not supported
  - `EMAIL` / `BuyerEmail` -> Not required in vault setup

- **Authentication:** Replace `USER`, `PWD`, `SIGNATURE` with OAuth 2.0 access token

- **Token Format:** Legacy returned "RP-{token}" format. REST returns a setup token ID.

- **Webhook Required:** Set up webhook for `VAULT.PAYMENT-TOKEN.CREATED` event to capture the payment token ID after customer approval.

