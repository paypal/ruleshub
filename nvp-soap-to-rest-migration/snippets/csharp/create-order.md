#### Create an order

```csharp
public static async Task<CreateOrderResult> CreateOrderAsync()
{
    try
    {
        var accessToken = await GetAccessTokenAsync();
        string createOrderUrl = $"{BaseUrl}/v2/checkout/orders";
        var payload = new {
            intent = "CAPTURE", // Legacy equivalents — NVP: PAYMENTREQUEST_n_PAYMENTACTION or PAYMENTACTION ; SOAP: PaymentDetails.PaymentAction
            purchase_units = new[]
            {
                new
                {
                    amount = new
                    {
                        currency_code = "USD", // Legacy equivalents — NVP: CURRENCYCODE ; SOAP: PaymentDetails.OrderTotal.currencyID
                        value = "10.00" // Legacy equivalents — NVP: AMT ; SOAP: PaymentDetails.OrderTotal
                    }
                }
            },
            payment_source = new
            {
                paypal = new
                {
                    experience_context = new
                    {
                        return_url = "http://localhost:3000/scenario/complete", // Legacy equivalents — NVP: RETURNURL ; SOAP: ReturnURL
                        cancel_url = "http://localhost:3000/scenario/cancel" // Legacy equivalents — NVP: CANCELURL ; SOAP: CancelURL
                    }
                }
            }
        };
        var request = new HttpRequestMessage(HttpMethod.Post, createOrderUrl)
        {
            Content = new StringContent(JsonConvert.SerializeObject(payload), Encoding.UTF8, "application/json")
        };
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", accessToken);
        // Optional but recommended for idempotency:
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
        var orderId = jsonResponse["id"]?.ToString();
        // Approval URL is returned as "payer-action" if "payment_source" was mentioned during order creation.
        // If "payment_source" was not mentioned, it is returned as "approve" in the HATEOAS links.
        var approvalUrl = jsonResponse["links"]
            ?.FirstOrDefault(l => l["rel"]?.ToString() == "approve" || l["rel"]?.ToString() == "payer-action")
            ?["href"]?.ToString(); 
        return new CreateOrderResult { OrderId = orderId, ApprovalUrl = approvalUrl };
    }
    catch (Exception e)
    {
        Console.WriteLine($"Error: {e.Message}");
        throw;
    }
}
```