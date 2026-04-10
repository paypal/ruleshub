# Prerequisites — PayPal Enterprise Checkout (ASP.NET Core 8+, C#)

Enterprise Checkout combines **Braintree Direct** (NuGet **`Braintree`**) for cards, vault, fraud tools, Drop-in UI, and Hosted Fields with **Multiparty / Platform** flows via **PayPal REST** (`HttpClient`). **Agentic Commerce / Store Sync** adds Cart operations. Use this checklist before you integrate.

## Runtime

- **.NET 8+** (LTS recommended).
- **ASP.NET Core** — Web API and/or Razor Pages for checkout pages, `System.Text.Json` for JSON.

## NuGet packages

### Core

```xml
<ItemGroup>
  <PackageReference Include="Braintree" Version="5.28.0" />
</ItemGroup>
```

Pin **`Braintree`** to the latest compatible release on [NuGet](https://www.nuget.org/packages/Braintree/).

### Multiparty REST, resilience (optional)

```xml
<ItemGroup>
  <PackageReference Include="Microsoft.Extensions.Http.Resilience" Version="8.0.0" />
</ItemGroup>
```

Use **`IHttpClientFactory`** + **`AddStandardResilienceHandler()`** (or Polly policies) for resilient calls to PayPal REST (`error-handling.md`).

## Configuration with `IConfiguration`

Bind secrets from **environment variables**, **User Secrets** (development), or a secrets manager — never commit **`BRAINTREE_PRIVATE_KEY`** or **`PAYPAL_CLIENT_SECRET`**.

### `appsettings.json` (non-secret structure only)

```json
{
  "Braintree": {
    "MerchantId": "",
    "PublicKey": "",
    "PrivateKey": "",
    "Environment": "Sandbox"
  },
  "PayPal": {
    "Environment": "sandbox",
    "ClientId": "",
    "ClientSecret": "",
    "PartnerMerchantId": "",
    "WebhookId": ""
  }
}
```

Override with environment variables, for example:

- `Braintree__MerchantId`, `Braintree__PrivateKey`, …
- `PayPal__ClientSecret`, …

### Braintree (`BraintreeGateway`)

| Variable | Description |
|----------|-------------|
| `BRAINTREE_MERCHANT_ID` | Merchant ID from the Braintree Control Panel |
| `BRAINTREE_PUBLIC_KEY` | Public key |
| `BRAINTREE_PRIVATE_KEY` | Private key — **server only** |
| `BRAINTREE_ENVIRONMENT` | `Sandbox` or `Production` (maps to `Braintree.Environment`) |

### PayPal REST (multiparty, Cart, webhooks)

| Variable | Description |
|----------|-------------|
| `PAYPAL_CLIENT_ID` | REST app Client ID from the [PayPal Developer Dashboard](https://developer.paypal.com/dashboard/) |
| `PAYPAL_CLIENT_SECRET` | REST secret — **server only** |
| `PAYPAL_ENVIRONMENT` | `sandbox` or `production` (selects REST base URL) |
| `PAYPAL_PARTNER_MERCHANT_ID` | Platform partner PayPal merchant ID (multiparty, `PayPal-Auth-Assertion` context) |

Optional: `PAYPAL_WEBHOOK_ID` for `POST /v1/notifications/verify-webhook-signature`.

### REST API base URLs

| Environment | Base URL |
|-------------|----------|
| Sandbox | `https://api-m.sandbox.paypal.com` |
| Production | `https://api-m.paypal.com` |

### Braintree environment mapping (server)

```csharp
using Braintree;

Environment btEnv = string.Equals(
    configuration["Braintree:Environment"],
    "Production",
    StringComparison.OrdinalIgnoreCase)
    ? Environment.PRODUCTION
    : Environment.SANDBOX;
```

## Multiparty payload conventions (PayPal REST)

For PayPal wallet flows in Orders API v2, use **`payment_source.paypal.experience_context`** (return/cancel URLs, branding, locale). **Do not** use the deprecated top-level **`application_context`** for new integrations.

## Suggested project layout

```
YourApp/
├── Configuration/     # Options classes, BraintreeGateway registration
├── Braintree/         # Transactions, vault, webhooks
├── PayPal/            # HttpClient, OAuth token helper
├── Pages/ or Controllers/
└── Middleware/        # Correlation, PayPal debug id logging
```

## Related snippets

- `braintree-client-token.md` — `gateway.ClientToken.Generate()`
- `multiparty-create-order.md` — `POST /v2/checkout/orders` with `platform_fees` and `experience_context`
- `agentic-commerce.md` — Cart API with `HttpClient`
