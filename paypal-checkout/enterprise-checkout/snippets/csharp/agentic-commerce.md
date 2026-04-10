# Agentic commerce / Store Sync — Cart API via `HttpClient`

**Store Sync** exposes product catalogs for AI agents; **Cart API** models carts server-side. Flow: **create cart** → buyer approves payment → **complete checkout** (or map cart to **Orders v2** / **Braintree** per your integration).

Use **`HttpClient`** for Cart operations and OAuth (same token as `seller-onboarding.md`).

REST bases: Sandbox **`https://api-m.sandbox.paypal.com`**, Production **`https://api-m.paypal.com`**.

## OAuth (reuse)

Use **`client_credentials`** token from your **`PayPalOAuthClient`** (`seller-onboarding.md`).

## `POST /v2/cart` — create

```csharp
using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;

namespace YourApp.PayPal;

public sealed class PayPalCartClient
{
    private readonly HttpClient _http;

    public PayPalCartClient(HttpClient http) => _http = http;

    public async Task<JsonDocument> CreateCartAsync(
        string accessToken,
        JsonElement cartPayload,
        CancellationToken cancellationToken = default)
    {
        var json = cartPayload.GetRawText();

        using var request = new HttpRequestMessage(HttpMethod.Post, "v2/cart");
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", accessToken);
        request.Headers.TryAddWithoutValidation("PayPal-Request-Id", Guid.NewGuid().ToString("N"));
        request.Content = new StringContent(json, Encoding.UTF8, "application/json");

        using var response = await _http.SendAsync(request, cancellationToken).ConfigureAwait(false);
        var body = await response.Content.ReadAsStringAsync(cancellationToken).ConfigureAwait(false);
        if (!response.IsSuccessStatusCode)
            throw new InvalidOperationException("create cart failed: " + body);

        return JsonDocument.Parse(body);
    }
```

Shape **`cartPayload`** per the current Cart API schema (intent, items, payee, experience context, etc.) in the [create cart reference](https://docs.paypal.ai/reference/api/rest/cart-operations/create-cart).

## `GET /v2/cart/{cart_id}` — details

```csharp
    public async Task<JsonDocument> GetCartAsync(
        string accessToken,
        string cartId,
        CancellationToken cancellationToken = default)
    {
        var encoded = Uri.EscapeDataString(cartId);
        using var request = new HttpRequestMessage(HttpMethod.Get, $"v2/cart/{encoded}");
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", accessToken);

        using var response = await _http.SendAsync(request, cancellationToken).ConfigureAwait(false);
        var body = await response.Content.ReadAsStringAsync(cancellationToken).ConfigureAwait(false);
        if (!response.IsSuccessStatusCode)
            throw new InvalidOperationException("get cart failed: " + body);

        return JsonDocument.Parse(body);
    }
```

## `PATCH /v2/cart/{cart_id}` — update

```csharp
    public async Task<JsonDocument> PatchCartAsync(
        string accessToken,
        string cartId,
        JsonElement patchBody,
        CancellationToken cancellationToken = default)
    {
        var encoded = Uri.EscapeDataString(cartId);
        var json = patchBody.GetRawText();

        using var request = new HttpRequestMessage(
            new HttpMethod("PATCH"),
            $"v2/cart/{encoded}");
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", accessToken);
        request.Headers.TryAddWithoutValidation("PayPal-Request-Id", Guid.NewGuid().ToString("N"));
        request.Content = new StringContent(json, Encoding.UTF8, "application/json");

        using var response = await _http.SendAsync(request, cancellationToken).ConfigureAwait(false);
        var body = await response.Content.ReadAsStringAsync(cancellationToken).ConfigureAwait(false);
        if (!response.IsSuccessStatusCode)
            throw new InvalidOperationException("patch cart failed: " + body);

        return JsonDocument.Parse(body);
    }
}
```

## Convert cart to order / complete checkout

1. **Orders v2 path** — map cart totals to **`POST /v2/checkout/orders`** (`multiparty-create-order.md` for platform fees and **`experience_context`**).
2. **Complete Checkout** — call **Complete Checkout** after buyer approval per the current API contract ([reference](https://docs.paypal.ai/reference/api/rest/checkout/complete-checkout)).
3. **Braintree path** — tokenize on client, then **`gateway.Transaction.Sale`** (`braintree-transaction.md`); vault if needed (`braintree-vault.md`).

Keep **one source of truth** for amounts across cart, Orders, and Braintree to avoid reconciliation errors.

## Agent discovery

Agents use **Store Sync** catalog endpoints and merchant-configured agentic surfaces; carts created via API let the buyer finish in PayPal checkout or your web app depending on integration.
