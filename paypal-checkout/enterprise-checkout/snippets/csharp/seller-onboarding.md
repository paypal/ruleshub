# Seller onboarding — `HttpClient` POST `/v2/customer/partner-referrals`, check status

Create a seller onboarding link with **`POST /v2/customer/partner-referrals`**. After the seller completes PayPal, check status with **`GET /v1/customer/partners/{partner_id}/merchant-integrations/{merchant_id}`**.

Base URLs:

| Environment | Base URL |
|-------------|----------|
| Sandbox | `https://api-m.sandbox.paypal.com` |
| Production | `https://api-m.paypal.com` |

Use **`HttpClient`** (preferably via **`IHttpClientFactory`**) for all PayPal multiparty REST calls (OAuth, referrals, status).

## OAuth client credentials

```csharp
using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;

namespace YourApp.PayPal;

public sealed class PayPalOAuthClient
{
    private readonly HttpClient _http;
    private readonly string _clientId;
    private readonly string _clientSecret;

    public PayPalOAuthClient(HttpClient http, IConfiguration configuration)
    {
        _http = http;
        _clientId = configuration["PayPal:ClientId"] ?? "";
        _clientSecret = configuration["PayPal:ClientSecret"] ?? "";
    }

    public async Task<string> GetAccessTokenAsync(CancellationToken cancellationToken = default)
    {
        var credentials = Convert.ToBase64String(Encoding.UTF8.GetBytes($"{_clientId}:{_clientSecret}"));
        using var request = new HttpRequestMessage(HttpMethod.Post, "v1/oauth2/token");
        request.Headers.Authorization = new AuthenticationHeaderValue("Basic", credentials);
        request.Content = new FormUrlEncodedContent(new Dictionary<string, string>
        {
            ["grant_type"] = "client_credentials",
        });

        using var response = await _http.SendAsync(request, cancellationToken).ConfigureAwait(false);
        response.EnsureSuccessStatusCode();

        await using var stream = await response.Content.ReadAsStreamAsync(cancellationToken).ConfigureAwait(false);
        var doc = await JsonDocument.ParseAsync(stream, cancellationToken: cancellationToken).ConfigureAwait(false);
        return doc.RootElement.GetProperty("access_token").GetString() ?? "";
    }
}
```

Register a named **`HttpClient`** with **`BaseAddress`** set to the sandbox or production API root (`prerequisites.md`). Bind **`PayPalOAuthClient`** with a **separate** client that shares the same base URL as your Orders client.

## `PayPalPartnerClient` — partner referrals + merchant integration

```csharp
using System.Net.Http.Headers;
using System.Text;

namespace YourApp.PayPal;

public sealed class PayPalPartnerClient
{
    private readonly HttpClient _api;

    public PayPalPartnerClient(IHttpClientFactory factory) =>
        _api = factory.CreateClient("PayPal");

    public async Task<string> CreatePartnerReferralAsync(
        string accessToken,
        string trackingId,
        string returnUrl,
        CancellationToken cancellationToken = default)
    {
        var body =
            $$"""
            {
              "tracking_id": "{{trackingId}}",
              "partner_config_override": { "return_url": "{{returnUrl}}" },
              "operations": [
                {
                  "operation": "API_INTEGRATION",
                  "api_integration_preference": {
                    "rest_api_integration": {
                      "integration_method": "PAYPAL",
                      "integration_type": "THIRD_PARTY",
                      "third_party_details": {
                        "features": ["PAYMENT", "REFUND", "PARTNER_FEE"]
                      }
                    }
                  }
                }
              ],
              "products": ["EXPRESS_CHECKOUT"],
              "legal_consents": [{ "type": "SHARE_DATA_CONSENT", "granted": true }]
            }
            """;

        using var request = new HttpRequestMessage(HttpMethod.Post, "v2/customer/partner-referrals");
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", accessToken);
        request.Content = new StringContent(body, Encoding.UTF8, "application/json");

        using var response = await _api.SendAsync(request, cancellationToken).ConfigureAwait(false);
        var text = await response.Content.ReadAsStringAsync(cancellationToken).ConfigureAwait(false);
        if (!response.IsSuccessStatusCode)
            throw new InvalidOperationException("partner-referrals failed: " + text);

        return text;
    }

    public async Task<string> MerchantIntegrationStatusAsync(
        string accessToken,
        string partnerId,
        string merchantId,
        CancellationToken cancellationToken = default)
    {
        var path =
            $"v1/customer/partners/{Uri.EscapeDataString(partnerId)}/merchant-integrations/{Uri.EscapeDataString(merchantId)}";

        using var request = new HttpRequestMessage(HttpMethod.Get, path);
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", accessToken);

        using var response = await _api.SendAsync(request, cancellationToken).ConfigureAwait(false);
        var text = await response.Content.ReadAsStringAsync(cancellationToken).ConfigureAwait(false);
        if (!response.IsSuccessStatusCode)
            throw new InvalidOperationException("merchant-integrations failed: " + text);

        return text;
    }
}
```

Resolve the seller **`action_url`** from **`links`** (`rel`: **`action_url`**) and redirect the seller there (parse JSON with **`System.Text.Json`**). If **`trackingId`** or **`returnUrl`** can contain characters that break JSON, build the payload with **`JsonObject`** instead of raw interpolation.

Key fields typically include **`payments_receivable`**, **`primary_email_confirmed`**, and **`oauth_integrations`**. Only route live payments after your checks pass.

## Notes

- Use a unique **`tracking_id`** per seller attempt for correlation.
- Store **`merchant_id`** (seller) securely after onboarding for **`PayPal-Auth-Assertion`** on orders (`multiparty-create-order.md`).
