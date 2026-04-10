# Braintree client token — `gateway.ClientToken.Generate()`, minimal API controller

Generate a **client token** on the server with **`gateway.ClientToken.Generate()`**. The browser uses it to initialize Drop-in, Hosted Fields, or 3DS. Optionally pass **`CustomerId`** to vault or show saved payment methods.

## `BraintreeGateway` registration (outline)

```csharp
using Braintree;
using Microsoft.Extensions.Options;

public sealed class BraintreeOptions
{
    public string MerchantId { get; init; } = "";
    public string PublicKey { get; init; } = "";
    public string PrivateKey { get; init; } = "";
    public string Environment { get; init; } = "Sandbox";
}

public static class BraintreeServiceCollectionExtensions
{
    public static IServiceCollection AddBraintreeGateway(this IServiceCollection services, IConfiguration configuration)
    {
        services.Configure<BraintreeOptions>(configuration.GetSection("Braintree"));
        services.AddSingleton<BraintreeGateway>(sp =>
        {
            var opt = sp.GetRequiredService<IOptions<BraintreeOptions>>().Value;
            var env = string.Equals(opt.Environment, "Production", StringComparison.OrdinalIgnoreCase)
                ? Environment.PRODUCTION
                : Environment.SANDBOX;
            return new BraintreeGateway(env, opt.MerchantId, opt.PublicKey, opt.PrivateKey);
        });
        return services;
    }
}
```

Register in `Program.cs`: `builder.Services.AddBraintreeGateway(builder.Configuration);`

## GET `/api/braintree/client-token` — minimal

```csharp
using Braintree;
using Microsoft.AspNetCore.Mvc;

namespace YourApp.Controllers;

[ApiController]
[Route("api/braintree")]
public sealed class BraintreeClientTokenController : ControllerBase
{
    private readonly BraintreeGateway _gateway;

    public BraintreeClientTokenController(BraintreeGateway gateway) => _gateway = gateway;

    [HttpGet("client-token")]
    public ActionResult<object> GetClientToken()
    {
        var token = _gateway.ClientToken.Generate();
        return Ok(new { client_token = token });
    }
}
```

## Optional `customerId` (vault / returning buyer)

Pass a Braintree **customer id** so the client can display vaulted payment methods (Drop-in `vaultManager`, etc.).

```csharp
    [HttpGet("client-token")]
    public ActionResult<object> GetClientToken([FromQuery] string? customerId)
    {
        if (string.IsNullOrWhiteSpace(customerId))
        {
            return Ok(new { client_token = _gateway.ClientToken.Generate() });
        }

        var request = new ClientTokenRequest { CustomerId = customerId };
        var token = _gateway.ClientToken.Generate(request);
        return Ok(new { client_token = token });
    }
```

## Error handling

- On failure, `Generate` throws — return **502** and log internally; never expose private keys.
- Validate **`customerId`** belongs to the signed-in user before passing it to `Generate`.

## Related

- `drop-in-ui-integration.md` — consume `client_token` in the browser.
- `braintree-vault.md` — create customers before passing `customerId`.
