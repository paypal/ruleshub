# Prerequisites — C# / .NET (PayPal Standard Checkout)

Use this checklist before integrating PayPal Standard Checkout with an ASP.NET Core backend and browser client.

## Runtime and framework

- **.NET 8** or newer (LTS). Target `net8.0` (or `net9.0`) in your project file.
- **ASP.NET Core** for HTTP APIs, dependency injection, configuration, and optional Razor Pages for checkout UI.

## NuGet packages

Core packages used across the snippets:

| Package | Purpose |
|--------|---------|
| `Microsoft.AspNetCore.App` (framework reference) | Web host, MVC, minimal APIs, configuration |
| `Microsoft.Extensions.Http` | Typed `HttpClient` registration, resilience hooks, named clients |
| `System.Text.Json` | JSON serialization for PayPal REST bodies and responses (included in the shared framework) |

Optional but recommended for production:

| Package | Purpose |
|--------|---------|
| `Microsoft.Extensions.Caching.Memory` | In-memory cache for OAuth and browser-safe client tokens |
| `Polly.Extensions.Http` | Transient retry policies for PayPal API calls (see error-handling snippet) |

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
    <PackageReference Include="Polly.Extensions.Http" Version="3.0.0" />
  </ItemGroup>
</Project>
```

Install via CLI:

```bash
dotnet add package Microsoft.Extensions.Http
dotnet add package Microsoft.Extensions.Caching.Memory
dotnet add package Polly.Extensions.Http
```

## Environment variables and configuration

Never commit secrets. Use **User Secrets** in development and **environment variables** or a **secrets manager** in production. Bind settings with `IConfiguration`.

| Key | Description |
|-----|-------------|
| `PayPal__ClientId` | REST app Client ID from the [PayPal Developer Dashboard](https://developer.paypal.com/dashboard/) |
| `PayPal__ClientSecret` | REST app secret (server-only) |
| `PayPal__Environment` | `Sandbox` or `Production` — selects the REST API base URL |
| `PayPal__WebhookId` | Webhook ID from the dashboard (for signature verification) |

`appsettings.Development.json` (no secrets):

```json
{
  "PayPal": {
    "Environment": "Sandbox"
  }
}
```

User Secrets (development):

```bash
dotnet user-secrets set "PayPal:ClientId" "your_client_id"
dotnet user-secrets set "PayPal:ClientSecret" "your_secret"
```

## PayPal REST API base URLs

Use these hosts for server-to-server calls:

| Environment | Base URL |
|-------------|----------|
| Sandbox | `https://api-m.sandbox.paypal.com` |
| Production | `https://api-m.paypal.com` |

Centralize selection in configuration:

```csharp
public sealed class PayPalOptions
{
    public const string SectionName = "PayPal";

    public string ClientId { get; set; } = "";
    public string ClientSecret { get; set; } = "";
    /// <summary>Sandbox or Production</summary>
    public string Environment { get; set; } = "Sandbox";
    /// <summary>Dashboard webhook ID for signature verification.</summary>
    public string? WebhookId { get; set; }

    public string ApiBaseUrl => Environment.Equals("Production", StringComparison.OrdinalIgnoreCase)
        ? "https://api-m.paypal.com"
        : "https://api-m.sandbox.paypal.com";
}
```

Register in `Program.cs`:

```csharp
builder.Services.Configure<PayPalOptions>(
    builder.Configuration.GetSection(PayPalOptions.SectionName));
```

## Suggested project structure

```
src/
├── Program.cs
├── appsettings.json
├── appsettings.Development.json
├── Controllers/
│   ├── PayPalAuthController.cs      # GET /paypal-api/auth/browser-safe-client-token
│   ├── PayPalCheckoutController.cs  # orders create, capture, get
│   └── PayPalWebhooksController.cs
├── Services/
│   ├── IPayPalAuthService.cs
│   ├── PayPalAuthService.cs
│   ├── IPayPalOrdersService.cs
│   └── PayPalOrdersService.cs
├── Models/
│   └── Checkout/
│       └── CreateOrderRequest.cs
├── Middleware/
│   └── PayPalExceptionHandlingMiddleware.cs
└── Pages/                            # optional Razor Pages for checkout
    └── Checkout.cshtml
```

## Security baseline

- Keep `PayPal:ClientSecret` only on the server; never embed it in Razor or static files.
- Serve checkout and APIs over **HTTPS** in production.
- **Validate amounts and currency on the server** before creating or capturing orders.
- Log **PayPal-Debug-Id** (and correlation IDs) from API responses for support.

## Common issues

| Issue | Resolution |
|-------|------------|
| Wrong API host | Use `api-m.sandbox` vs `api-m` consistently with dashboard app mode and credentials. |
| `401 INVALID_CLIENT` | Client ID/secret mismatch or wrong environment. |
| Missing JSON options | Use `PropertyNamingPolicy = JsonNamingPolicy.SnakeCaseLower` (or camelCase) consistently with PayPal JSON field names. |

## Best practices

- Use **typed `HttpClient`** (`IHttpClientFactory`) with a named client `"PayPal"` and base address from `PayPalOptions`.
- Fail fast at startup if required PayPal settings are missing in non-development environments.
- Use one PayPal app per environment (sandbox vs live) with matching credentials.
