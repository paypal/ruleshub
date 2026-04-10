# Multiparty create order — `POST /v2/checkout/orders`, platform fees, Auth-Assertion, `experience_context`

Create a **PayPal** order where the **seller** is the payee and the **platform** takes a fee. Use **`payment_source.paypal.experience_context`** for locale, brand, shipping, return/cancel URLs, etc. **Do not** use deprecated top-level **`application_context`** for new integrations.

Use **`PayPal-Auth-Assertion`** (JWT) so PayPal knows the partner is acting for the seller.

REST bases: Sandbox **`https://api-m.sandbox.paypal.com`**, Production **`https://api-m.paypal.com`**.

## Build Auth-Assertion JWT (header value)

The assertion is a **signed JWT** whose claims include (at minimum) **`iss`** = partner REST **client_id** and **`payer_id`** = **seller merchant id**. Generate per PayPal multiparty docs (algorithm and key material from your partner app).

```text
PayPal-Auth-Assertion: eyJhbGciOi...<JWT>...
```

Inject the JWT string your signing utility returns into **`PayPal-Auth-Assertion`**.

## `POST /v2/checkout/orders` — `HttpClient`

```csharp
using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using System.Text.Json.Nodes;

namespace YourApp.PayPal;

public sealed class MultipartyOrdersClient
{
    private readonly HttpClient _http;

    public MultipartyOrdersClient(HttpClient http) => _http = http;

    /// <param name="authAssertionJwt">Signed JWT per PayPal multiparty (iss=partner client_id, payer_id=seller_merchant_id)</param>
    public async Task<string> CreateOrderAsync(
        string accessToken,
        string sellerMerchantId,
        string platformFeeAmount,
        string itemTotal,
        string currencyCode,
        string authAssertionJwt,
        CancellationToken cancellationToken = default)
    {
        var root = new JsonObject
        {
            ["intent"] = "CAPTURE",
            ["purchase_units"] = new JsonArray
            {
                new JsonObject
                {
                    ["reference_id"] = "default",
                    ["amount"] = new JsonObject
                    {
                        ["currency_code"] = currencyCode,
                        ["value"] = itemTotal,
                        ["breakdown"] = new JsonObject
                        {
                            ["item_total"] = new JsonObject
                            {
                                ["currency_code"] = currencyCode,
                                ["value"] = itemTotal,
                            },
                        },
                    },
                    ["payee"] = new JsonObject
                    {
                        ["merchant_id"] = sellerMerchantId,
                    },
                    ["payment_instruction"] = new JsonObject
                    {
                        ["platform_fees"] = new JsonArray
                        {
                            new JsonObject
                            {
                                ["amount"] = new JsonObject
                                {
                                    ["currency_code"] = currencyCode,
                                    ["value"] = platformFeeAmount,
                                },
                            },
                        },
                    },
                },
            },
            ["payment_source"] = new JsonObject
            {
                ["paypal"] = new JsonObject
                {
                    ["experience_context"] = new JsonObject
                    {
                        ["payment_method_preference"] = "IMMEDIATE_PAYMENT_REQUIRED",
                        ["brand_name"] = "My Marketplace",
                        ["locale"] = "en-US",
                        ["landing_page"] = "LOGIN",
                        ["user_action"] = "PAY_NOW",
                        ["return_url"] = "https://yourplatform.com/paypal/return",
                        ["cancel_url"] = "https://yourplatform.com/paypal/cancel",
                        ["shipping_preference"] = "GET_FROM_FILE",
                    },
                },
            },
        };

        var json = root.ToJsonString(new JsonSerializerOptions { WriteIndented = false });

        using var request = new HttpRequestMessage(HttpMethod.Post, "v2/checkout/orders");
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", accessToken);
        request.Headers.TryAddWithoutValidation("PayPal-Auth-Assertion", authAssertionJwt);
        request.Headers.TryAddWithoutValidation("PayPal-Partner-Attribution-Id", "PARTNER_BN_CODE");
        request.Content = new StringContent(json, Encoding.UTF8, "application/json");

        using var response = await _http.SendAsync(request, cancellationToken).ConfigureAwait(false);
        var body = await response.Content.ReadAsStringAsync(cancellationToken).ConfigureAwait(false);
        if (!response.IsSuccessStatusCode)
            throw new InvalidOperationException("create order failed: " + body);

        return body;
    }
}
```

Ensure **`HttpClient.BaseAddress`** is set to **`https://api-m.sandbox.paypal.com/`** or **`https://api-m.paypal.com/`** (with trailing slash) so relative paths resolve.

## Important

- **`purchase_units[].payee.merchant_id`**: seller (connected) merchant id.
- **`payment_instruction.platform_fees`**: platform cut; currency must match the transaction currency.
- **`payment_source.paypal.experience_context`**: payment-source UX (not legacy **`application_context`**).
- **`PayPal-Auth-Assertion`**: required for partner-initiated seller transactions per multiparty documentation.

Approve and capture on the client with the JS SDK using the returned **`id`**, then capture on the server (`multiparty-capture.md`).
