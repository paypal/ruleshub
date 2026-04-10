# Multiparty capture and refunds — `HttpClient`, Auth-Assertion, platform fee refund

**Capture** the approved order with **`POST /v2/checkout/orders/{order_id}/capture`** and the same **`PayPal-Auth-Assertion`** pattern used at create time. **Refunds** can include **`payment_instruction.platform_fees`** to refund part of the platform fee.

REST bases: Sandbox **`https://api-m.sandbox.paypal.com`**, Production **`https://api-m.paypal.com`**.

## `MultipartyCaptureClient` — capture + refund

```csharp
using System.Net.Http.Headers;
using System.Text;
using System.Text.Json.Nodes;

namespace YourApp.PayPal;

public sealed class MultipartyCaptureClient
{
    private readonly HttpClient _http;

    public MultipartyCaptureClient(HttpClient http) => _http = http;

    public async Task<string> CaptureOrderAsync(
        string accessToken,
        string orderId,
        string authAssertionJwt,
        CancellationToken cancellationToken = default)
    {
        var encoded = Uri.EscapeDataString(orderId);
        using var request = new HttpRequestMessage(
            HttpMethod.Post,
            $"v2/checkout/orders/{encoded}/capture");

        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", accessToken);
        request.Headers.TryAddWithoutValidation("PayPal-Auth-Assertion", authAssertionJwt);
        request.Content = new StringContent("{}", Encoding.UTF8, "application/json");

        using var response = await _http.SendAsync(request, cancellationToken).ConfigureAwait(false);
        var body = await response.Content.ReadAsStringAsync(cancellationToken).ConfigureAwait(false);
        if (!response.IsSuccessStatusCode)
            throw new InvalidOperationException("capture failed: " + body);

        return body;
    }

    public async Task<string> RefundCaptureWithPlatformFeeAsync(
        string accessToken,
        string captureId,
        string totalRefundAmount,
        string platformFeeRefundAmount,
        string currencyCode,
        string authAssertionJwt,
        CancellationToken cancellationToken = default)
    {
        var refundBody = new JsonObject
        {
            ["amount"] = new JsonObject
            {
                ["currency_code"] = currencyCode,
                ["value"] = totalRefundAmount,
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
                            ["value"] = platformFeeRefundAmount,
                        },
                    },
                },
            },
        };

        var json = refundBody.ToJsonString();
        var encodedCapture = Uri.EscapeDataString(captureId);

        using var request = new HttpRequestMessage(
            HttpMethod.Post,
            $"v2/payments/captures/{encodedCapture}/refund");

        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", accessToken);
        request.Headers.TryAddWithoutValidation("PayPal-Auth-Assertion", authAssertionJwt);
        request.Content = new StringContent(json, Encoding.UTF8, "application/json");

        using var response = await _http.SendAsync(request, cancellationToken).ConfigureAwait(false);
        var text = await response.Content.ReadAsStringAsync(cancellationToken).ConfigureAwait(false);
        if (!response.IsSuccessStatusCode)
            throw new InvalidOperationException("refund failed: " + text);

        return text;
    }
}
```

### Fee split (response)

Parse **`purchase_units[0].payments.captures[0].seller_receivable_breakdown`** (and related fields) per Orders API v2 schema for reconciliation.

Align **`platform_fees`** amounts with PayPal multiparty refund rules (currency match, eligible captures). Consult the current API reference for optional fields (invoice id, note to payer).
