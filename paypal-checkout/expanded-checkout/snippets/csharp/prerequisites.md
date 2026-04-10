# Prerequisites — C# / ASP.NET Core (PayPal Expanded Checkout)

Use this checklist before integrating **Expanded (Advanced) Checkout** with custom **Card Fields**, **3D Secure**, **Fastlane**, **Apple Pay**, **Google Pay**, and optional **vaulting**, backed by an **ASP.NET Core 8+** host and **`HttpClient`**.

## Runtime and framework

- **.NET 8** or newer (LTS). Target `net8.0` (or `net9.0`) in your project file.
- **ASP.NET Core** for HTTP APIs, dependency injection, **`IConfiguration`**, and Razor Pages or MVC views for checkout HTML.

## NuGet packages

Core packages used across the snippets:

| Package | Purpose |
|--------|---------|
| `Microsoft.AspNetCore.App` (framework reference) | Web host, minimal APIs/MVC, configuration |
| `Microsoft.Extensions.Http` | Typed **`HttpClient`** via `IHttpClientFactory` |
| `System.Text.Json` | JSON for PayPal REST bodies and responses (shared framework) |

Recommended for production:

| Package | Purpose |
|--------|---------|
| `Microsoft.Extensions.Caching.Memory` | Cache OAuth tokens and browser-safe **client tokens** |
| `Polly.Extensions.Http` | Retries for transient PayPal HTTP failures (see **error-handling** snippet) |

Example `.csproj` excerpt:

```xml
<Project Sdk="Microsoft.NET.Sdk.Web">
  <PropertyGroup>
    <TargetFramework>net8.0</TargetFramework>
    <Nullable>enable</Nullable>
    <ImplicitUsings>enable</ImplicitUsings>
  </PropertyGroup>
  <ItemGroup>
    <PackageReference Include="Microsoft.Extensions.Http" Version="8.0.0" />
    <PackageReference Include="Microsoft.Extensions.Caching.Memory" Version="8.0.0" />
    <PackageReference Include="Polly.Extensions.Http" Version="3.0.0" />
  </ItemGroup>
</Project>
```

## Configuration with `IConfiguration`

Bind PayPal settings from **environment variables**, **User Secrets** (development), or **Azure Key Vault** — never hard-code secrets.

| Key | Description |
|-----|-------------|
| `PayPal__ClientId` | REST app Client ID from the [PayPal Developer Dashboard](https://developer.paypal.com/dashboard/) |
| `PayPal__ClientSecret` | REST secret (**server-only**) |
| `PayPal__Environment` | `Sandbox` or `Production` — selects REST base URL |
| `PayPal__WebhookId` | Webhook ID for signature verification |

```csharp
// Program.cs
builder.Services.Configure<PayPalOptions>(
    builder.Configuration.GetSection(PayPalOptions.SectionName));
```

`appsettings.Development.json` (no secrets):

```json
{
  "PayPal": {
    "Environment": "Sandbox"
  }
}
```

```bash
dotnet user-secrets set "PayPal:ClientId" "your_client_id"
dotnet user-secrets set "PayPal:ClientSecret" "your_secret"
```

## PayPal REST API base URLs (server-to-server)

Use these hosts for **`HttpClient`** calls:

| Environment | Base URL |
|-------------|----------|
| Sandbox | `https://api-m.sandbox.paypal.com` |
| Production | `https://api-m.paypal.com` |

```csharp
public sealed class PayPalOptions
{
    public const string SectionName = "PayPal";

    public string ClientId { get; set; } = "";
    public string ClientSecret { get; set; } = "";
    public string Environment { get; set; } = "Sandbox";
    public string? WebhookId { get; set; }

    public string ApiBaseUrl => Environment.Equals("Production", StringComparison.OrdinalIgnoreCase)
        ? "https://api-m.paypal.com"
        : "https://api-m.sandbox.paypal.com";
}
```

## Orders API shape (Expanded Checkout)

- Use **`payment_source.card`** for card-funded orders (Card Fields / 3DS).
- Use **`payment_source.paypal.experience_context`** for PayPal wallet UX — do **not** use deprecated top-level **`application_context`** for new integrations.

## Expanded Checkout eligibility

Expanded Checkout requires **merchant eligibility** (countries, currencies, features). Confirm before building:

- [Expanded Checkout eligibility](https://developer.paypal.com/docs/checkout/advanced/eligibility/)

If you only need PayPal buttons without hosted card fields, **Standard Checkout** may suffice.

## Security baseline

- Keep **`PayPal:ClientSecret`** and REST **Bearer** tokens on the server only.
- Serve checkout over **HTTPS** in production.
- **Validate amount, currency, and intent** on every create/capture.
- Card PAN/CVV are handled inside PayPal **Card Fields** — do not collect raw card data in your own inputs.

## Common issues

| Issue | Resolution |
|-------|------------|
| `401 INVALID_CLIENT` | Client ID/secret mismatch or wrong sandbox vs live app. |
| Card Fields not eligible | Check eligibility; region and account settings apply. |
| Wrong JSON shape | Prefer `JsonNamingPolicy.SnakeCaseLower` and match **`payment_source`** structure above. |
