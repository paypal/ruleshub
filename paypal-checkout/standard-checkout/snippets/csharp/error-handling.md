# Error handling — ASP.NET Core + PayPal APIs

Centralize HTTP failures, surface **`PayPal-Debug-Id`** for support, and add **retries** for transient errors when calling PayPal with **`HttpClient`**.

## PayPal correlation headers

Successful and failed PayPal REST responses often include:

| Header | Use |
|--------|-----|
| `PayPal-Debug-Id` | Include in merchant support tickets |
| `PayPal-Request-Id` | Echo your idempotency key when you sent one |

### Extract from `HttpResponseMessage`

```csharp
private static string? GetPayPalDebugId(HttpResponseMessage response)
{
    return response.Headers.TryGetValues("PayPal-Debug-Id", out var values)
        ? values.FirstOrDefault()
        : null;
}
```

Log at **Warning** or **Error** with status code, response body (truncated if large), and **debug id**.

## Typed exception (optional)

```csharp
namespace YourApp.PayPal;

public sealed class PayPalApiException : Exception
{
    public PayPalApiException(string message, HttpStatusCode statusCode, string? debugId, string? responseBody)
        : base(message)
    {
        StatusCode = statusCode;
        DebugId = debugId;
        ResponseBody = responseBody;
    }

    public HttpStatusCode StatusCode { get; }
    public string? DebugId { get; }
    public string? ResponseBody { get; }
}
```

Throw after failed `SendAsync` when you want middleware to map to **Problem Details**.

## Exception handling middleware

```csharp
using System.Net;
using System.Text.Json;
using Microsoft.AspNetCore.Diagnostics;
using YourApp.PayPal;

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
        catch (PayPalApiException ex)
        {
            _logger.LogError(ex, "PayPal API error. DebugId={DebugId}", ex.DebugId);
            if (!context.Response.HasStarted)
            {
                context.Response.StatusCode = (int)HttpStatusCode.BadGateway;
                context.Response.ContentType = "application/json";
                await context.Response.WriteAsync(JsonSerializer.Serialize(new
                {
                    title = "PayPal API error",
                    status = 502,
                    detail = ex.Message,
                    paypalDebugId = ex.DebugId
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

Register after routing / before endpoints as appropriate:

```csharp
app.UsePayPalExceptionHandling();
```

> Map **`PayPalApiException`** only for routes that call PayPal; alternatively use a single generic handler and branch on exception type.

## Retry with Polly (`Polly.Extensions.Http`)

Transient failures (e.g. **503**, **429**) can be retried with backoff.

```bash
dotnet add package Polly.Extensions.Http
```

```csharp
using System.Net;
using Microsoft.Extensions.DependencyInjection;
using Polly;
using Polly.Extensions.Http;

builder.Services.AddHttpClient("PayPal", (sp, client) =>
{
    var opts = sp.GetRequiredService<IOptions<PayPalOptions>>().Value;
    client.BaseAddress = new Uri(opts.ApiBaseUrl);
})
.AddPolicyHandler(HttpPolicyExtensions
    .HandleTransientHttpError()
    .OrResult(r => r.StatusCode == HttpStatusCode.TooManyRequests)
    .WaitAndRetryAsync(3, attempt => TimeSpan.FromMilliseconds(200 * Math.Pow(2, attempt))));
```

> Tune **which status codes** to retry; **do not** blindly retry **POST** if you cannot guarantee idempotency—use **`PayPal-Request-Id`** on mutating calls.

### Manual exponential backoff (no Polly)

```csharp
public static async Task<HttpResponseMessage> SendWithRetryAsync(
    this HttpClient client,
    HttpRequestMessage request,
    int maxAttempts = 3,
    CancellationToken cancellationToken = default)
{
    var delay = TimeSpan.FromMilliseconds(300);
    for (var attempt = 1; ; attempt++)
    {
        using var clone = await CloneRequestAsync(request);
        var response = await client.SendAsync(clone, cancellationToken);

        if (attempt >= maxAttempts ||
            response.StatusCode is not HttpStatusCode.TooManyRequests
                and not HttpStatusCode.ServiceUnavailable
                and not HttpStatusCode.BadGateway)
            return response;

        await Task.Delay(delay, cancellationToken);
        delay += delay;
    }
}

private static async Task<HttpRequestMessage> CloneRequestAsync(HttpRequestMessage original)
{
    var clone = new HttpRequestMessage(original.Method, original.RequestUri);
    foreach (var header in original.Headers)
        clone.Headers.TryAddWithoutValidation(header.Key, header.Value);
    if (original.Content is not null)
    {
        var ms = new MemoryStream();
        await original.Content.CopyToAsync(ms);
        ms.Position = 0;
        clone.Content = new StreamContent(ms);
        foreach (var header in original.Content.Headers)
            clone.Content.Headers.TryAddWithoutValidation(header.Key, header.Value);
    }
    return clone;
}
```

> Cloning requests with bodies is subtle; prefer **Polly** / **`IHttpClientFactory`** resilience or ensure **idempotent** replays.

## Configuration via `IConfiguration`

Bind **`PayPal`** section for retry counts and logging level:

```json
{
  "PayPal": {
    "Environment": "Sandbox",
    "MaxRetryAttempts": 3
  }
}
```

## REST base URLs

- **Sandbox:** `https://api-m.sandbox.paypal.com`
- **Production:** `https://api-m.paypal.com`
