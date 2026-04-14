#### SNIPPET-GetBACustomerDetails

**Retrieve setup token details (Flow B Migration)**

>  **Legacy Context:** This replaces the deprecated `GetBillingAgreementCustomerDetails` API. **Critical:** The legacy API returned extensive customer information. The modern API returns token status but NOT detailed customer info.

```csharp
public static async Task<SetupTokenResponse?> GetSetupTokenDetailsAsync(string setupTokenId)
{
    try
    {
        var accessToken = await GetAccessTokenAsync();
        string getSetupTokenUrl = $"{BaseUrl}/v3/vault/setup-tokens/{setupTokenId}";
        
        var request = new HttpRequestMessage(HttpMethod.Get, getSetupTokenUrl);
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
        
        var setupToken = JsonConvert.DeserializeObject<SetupTokenResponse>(responseBody);
        Console.WriteLine($"Setup Token Status: {setupToken?.Status}");
        
        return setupToken;
    }
    catch (Exception e)
    {
        Console.WriteLine($"Error: {e.Message}");
        throw;
    }
}
```

** Critical Migration Warning: Customer Data NOT Available**

The legacy `GetBillingAgreementCustomerDetails` API returned:
-  Customer email, name, address (NVP: ALL fields unsupported)
-  Customer email, name, address (SOAP: SOME fields available in payment token response)
-  Payer ID, payer status
-  Shipping information

**The modern REST API response includes:**
-  Setup token status and ID
-  Payment source type
-  Links for approval and other actions
-  NO customer personal information in this call

**Migration Strategy:**

1. **For NVP Users:** You MUST store customer information in your own database before redirecting to PayPal. The REST API will not return this data.

2. **For SOAP Users:** Some customer data is available after creating the payment token:
```csharp
public class CustomerData
{
    public string Email { get; set; }
    public string AccountId { get; set; }
    public string Name { get; set; }
    public Dictionary<string, string> Address { get; set; }
}

public static async Task<CustomerData?> GetPaymentTokenDetailsAsync(string paymentTokenId)
{
    var accessToken = await GetAccessTokenAsync();
    string url = $"{BaseUrl}/v3/vault/payment-tokens/{paymentTokenId}";
    
    var request = new HttpRequestMessage(HttpMethod.Get, url);
    request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", accessToken);
    
    var response = await HttpClient.SendAsync(request);
    var responseBody = await response.Content.ReadAsStringAsync();
    var data = JsonConvert.DeserializeObject<dynamic>(responseBody);
    
    // Extract available customer fields
    var paypal = data?.payment_source?.paypal;
    
    return new CustomerData
    {
        Email = paypal?.email_address?.ToString(),
        AccountId = paypal?.account_id?.ToString(),
        Name = paypal?.name?.full_name?.ToString(),
        Address = paypal?.address != null 
            ? JsonConvert.DeserializeObject<Dictionary<string, string>>(paypal.address.ToString()) 
            : null
    };
}
```

3. **Alternative:** Use PayPal Identity APIs after customer authorization to get detailed customer information.

**Fields NOT Available in v3 (Plan Accordingly):**

**NVP Response - ALL UNSUPPORTED:**
- `EMAIL`, `FIRSTNAME`, `LASTNAME`, `PAYERID`, `PAYERSTATUS`
- `COUNTRYCODE`, `ADDRESSSTATUS`, `PAYERBUSINESS`
- `SHIPTONAME`, `SHIPTOSTREET`, `SHIPTOCITY`, `SHIPTOSTATE`, `SHIPTOZIP`

**SOAP Response - PARTIALLY SUPPORTED:**
- `PayerInfo.Payer` maps to `payment_source.paypal.email_address`
- `PayerInfo.PayerID` maps to `payment_source.paypal.account_id`
- `PayerInfo.Address.*` maps to `payment_source.paypal.address.*`
- `PayerInfo.PayerStatus`, `PayerInfo.PayerBusiness` - Not supported
- Separate first/last/middle names - Only full_name available

