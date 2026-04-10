# Error handling — Braintree + multiparty PayPal REST + Polly

Centralize logging with **transaction ids**, Braintree correlation where available, and PayPal **`paypal-debug-id`** / response **`details`** for support.

## Braintree — failed `Result<T>` (not always an exception)

`Transaction.Sale` and related calls return **`Result<T>`**. Prefer **`IsSuccess()`** and inspect **`Message`**, **`Transaction`**, and deep validation errors before treating as a hard exception.

### `processor_declined` (typical codes 2000–2999)

- Map **`ProcessorResponseCode`** and **`ProcessorResponseText`** to user-safe messages (avoid echoing raw processor text if it may leak sensitive data).
- Codes in the **2000–2999** range often indicate issuer/processor declines. Treat as **retry may not help** unless the buyer changes the instrument.

### `gateway_rejected`

- Inspect **`GatewayRejectionReason`** (risk rules, AVS/CVV policy, etc.).
- Log **`transaction.Id`** when present.

### Validation errors

- On failed **`Customer.Create`**, **`Transaction.Sale`**, etc., inspect **`result.Errors`** (deep validation) on the result object.
- Return field-level messages to your UI only when safe (no internal stack traces).

### C# — transaction sale failure logging

```csharp
using Braintree;

static void LogBraintreeFailure(Result<Transaction> result)
{
    if (result.IsSuccess())
        return;

    var tx = result.Target;
    // result.Message, tx?.ProcessorResponseCode, tx?.ProcessorResponseText, tx?.GatewayRejectionReason
    // Log server-side; return generic message to client
}
```

## Braintree — exceptions (`Braintree.Exceptions`)

Gateway calls can throw **`BraintreeException`** subclasses (for example **`NotFoundException`**, **`AuthenticationException`**) for invalid API keys, missing resources, or network issues surfaced by the SDK.

```csharp
using Braintree.Exceptions;

try
{
    var customer = gateway.Customer.Find(id);
    _ = customer.Id;
}
catch (NotFoundException ex)
{
    // log ex.Message — do not return raw details to clients in production
}
catch (BraintreeException ex)
{
    // log, map to 502/503 as appropriate
}
```

## Multiparty / PayPal REST

### Auth failures

- **401** — refresh OAuth token; verify **`PayPal:ClientId`** / **`PayPal:ClientSecret`** and sandbox vs production base URL.
- **403** — missing scopes or partner permissions; confirm the REST app is enabled for multiparty features.

### Seller not consented / onboarding incomplete

- **`payments_receivable`** false on merchant integration — block captures; re-run onboarding (`seller-onboarding.md`).

### Platform fee errors

- Currency mismatch with transaction or payee configuration.
- Fee amount exceeds allowed split — compare against PayPal multiparty rules and purchase unit totals.
- **422 Unprocessable Entity** — read **`details`** array in the error JSON body.

### Log PayPal **`paypal-debug-id`**

```csharp
using System.Net.Http.Headers;

static void LogIfPayPalError(HttpResponseMessage response, string body)
{
    if (response.IsSuccessStatusCode)
        return;

    if (response.Headers.TryGetValues("paypal-debug-id", out var values))
    {
        var debugId = string.Join(",", values);
        // ILogger: log with debugId + status + body
    }
}
```

Always log **`paypal-debug-id`** from response headers when present.

## ASP.NET Core — global exception middleware (outline)

Use **`UseExceptionHandler`** or a custom middleware to return **`ProblemDetails`** JSON without leaking stack traces in production.

```csharp
app.UseExceptionHandler(errorApp =>
{
    errorApp.Run(async context =>
    {
        context.Response.StatusCode = StatusCodes.Status500InternalServerError;
        context.Response.ContentType = "application/problem+json";
        await context.Response.WriteAsJsonAsync(new
        {
            title = "An error occurred",
            status = 500,
        });
    });
});
```

## Polly — resilient `HttpClient` for PayPal REST

Add **`Microsoft.Extensions.Http.Resilience`** (retry / circuit breaker / timeout via Polly v8) or **`Microsoft.Extensions.Http.Polly`** with explicit policies.

```csharp
using Microsoft.Extensions.Http.Resilience;

builder.Services.AddHttpClient("PayPal", (sp, client) =>
{
    var env = sp.GetRequiredService<IConfiguration>()["PayPal:Environment"];
    client.BaseAddress = new Uri(
        string.Equals(env, "production", StringComparison.OrdinalIgnoreCase)
            ? "https://api-m.paypal.com/"
            : "https://api-m.sandbox.paypal.com/");
})
.AddStandardResilienceHandler();
```

`AddStandardResilienceHandler()` applies sensible defaults for transient HTTP failures. Alternatively use **`AddPolicyHandler`** with custom Polly policies for **`WaitAndRetryAsync`** on **429** / **5xx**.

## Client vs server messaging

- **Server** decides whether a decline is retryable; **client** shows a generic failure plus a support reference id, not raw processor codes in production unless you maintain a curated mapping.
