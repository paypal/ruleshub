# Error handling — Card declines, middleware, Polly (ASP.NET Core + PayPal)

Handle **card decline** and **REST** errors from **`POST /v2/checkout/orders`** and **`.../capture`**, log **`PayPal-Debug-Id`**, and add **Polly** retries for transient **`HttpClient`** failures.

## PayPal error body

Failed responses often include JSON with **`name`**, **`message`**, **`details`**. For card issues, see [Card decline errors](https://developer.paypal.com/docs/checkout/advanced/card-decline-errors/).

### Log correlation headers

```csharp
private static string? GetPayPalDebugId(HttpResponseMessage response) =>
    response.Headers.TryGetValues("PayPal-Debug-Id", out var v) ? v.FirstOrDefault() : null;
```

## Map card-related failures for the client

```csharp
using System.Net;
using System.Text.Json;

public static class PayPalErrorMapper
{
    public static (int status, object body) FromPayPalContent(string json, HttpStatusCode httpStatus)
    {
        try
        {
            using var doc = JsonDocument.Parse(json);
            var root = doc.RootElement;
            var name = root.TryGetProperty("name", out var n) ? n.GetString() : null;
            var message = root.TryGetProperty("message", out var m) ? m.GetString() : null;

            if (name is "UNPROCESSABLE_ENTITY" or "INSTRUMENT_DECLINED")
                return (StatusCodes.Status402PaymentRequired, new { name, message });

            return ((int)httpStatus, new { name, message, raw = json });
        }
        catch
        {
            return ((int)httpStatus, new { detail = json });
        }
    }
}
```

Use **402** only if your API contract treats declines as a distinct client state; otherwise return **400**/**502** consistently.

## Exception handling middleware

```csharp
using System.Net;
using System.Text.Json;
using Microsoft.AspNetCore.Diagnostics;

namespace YourApp.Middleware;

public sealed class PayPalExceptionHandlingMiddleware
{
    private readonly RequestDelegate _next;
    private readonly ILogger<PayPalExceptionHandlingMiddleware> _logger;

    public PayPalExceptionHandlingMiddleware(RequestDelegate next, ILogger<PayPalExceptionHandlingMiddleware> logger)
    {
        _next = next;
        _logger = logger;
    }

    public async Task Invoke(HttpContext context)
    {
        try
        {
            await _next(context);
        }
        catch (HttpRequestException ex)
        {
            _logger.LogError(ex, "Downstream HTTP failure (e.g. PayPal)");
            if (!context.Response.HasStarted)
            {
                context.Response.StatusCode = (int)HttpStatusCode.BadGateway;
                context.Response.ContentType = "application/json";
                await context.Response.WriteAsync(JsonSerializer.Serialize(new
                {
                    title = "Payment provider error",
                    status = 502,
                    detail = ex.Message
                }));
            }
        }
    }
}

public static class PayPalExceptionHandlingMiddlewareExtensions
{
    public static IApplicationBuilder UsePayPalExceptionHandling(this IApplicationBuilder app)
        => app.UseMiddleware<PayPalExceptionHandlingMiddleware>();
}
```

Register early in the pipeline:

```csharp
app.UsePayPalExceptionHandling();
```

## Polly retry for transient API errors

```csharp
using Microsoft.Extensions.DependencyInjection;
using Polly;
using Polly.Extensions.Http;

builder.Services.AddHttpClient("PayPal")
    .ConfigureHttpClient((sp, client) =>
    {
        var opts = sp.GetRequiredService<Microsoft.Extensions.Options.IOptions<PayPalOptions>>().Value;
        client.BaseAddress = new Uri(opts.ApiBaseUrl);
    })
    .AddPolicyHandler(HttpPolicyExtensions
        .HandleTransientHttpError()
        .OrResult(msg => (int)msg.StatusCode == 429)
        .WaitAndRetryAsync(3, attempt => TimeSpan.FromMilliseconds(200 * attempt)));
```

**Do not** blindly retry **create/capture** with the same idempotency key without understanding side effects; prefer **`PayPal-Request-Id`** for safe retries of **create**.

## REST hosts

- Sandbox: `https://api-m.sandbox.paypal.com`
- Production: `https://api-m.paypal.com`
