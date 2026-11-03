#### Generate Client Token for v6 SDK

Server-side OAuth token acquisition **must not** live as a public method on an `[ApiController]`. ASP.NET Core's controller-action discovery registers any public instance method on a controller as an action unless it is `private`, `[NonAction]`, or defined outside the controller type — so a public helper with no `[HttpGet]`/`[HttpPost]` attribute is still reachable over HTTP under the controller's route, unauthenticated. Put token acquisition in its own service class instead, and inject that service wherever a server bearer is needed (see `create-order.md`, `fastlane-backend.md`).

```csharp
using Microsoft.AspNetCore.Mvc;
using System.Net.Http;
using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;

public interface IPayPalTokenService
{
    Task<string> GetAccessTokenAsync();
}

public class PayPalTokenService : IPayPalTokenService
{
    private readonly string _paypalBase = Environment.GetEnvironmentVariable("PAYPAL_BASE") ?? "https://api-m.sandbox.paypal.com";
    private readonly string _clientId = Environment.GetEnvironmentVariable("PAYPAL_CLIENT_ID");
    private readonly string _clientSecret = Environment.GetEnvironmentVariable("PAYPAL_CLIENT_SECRET");
    private readonly HttpClient _httpClient;

    public PayPalTokenService(IHttpClientFactory httpClientFactory)
    {
        _httpClient = httpClientFactory.CreateClient();
    }

    public async Task<string> GetAccessTokenAsync()
    {
        var auth = Convert.ToBase64String(Encoding.UTF8.GetBytes($"{_clientId}:{_clientSecret}"));

        var request = new HttpRequestMessage(HttpMethod.Post, $"{_paypalBase}/v1/oauth2/token");
        request.Headers.Authorization = new AuthenticationHeaderValue("Basic", auth);
        request.Content = new StringContent(
            "grant_type=client_credentials",
            Encoding.UTF8,
            "application/x-www-form-urlencoded"
        );

        var response = await _httpClient.SendAsync(request);
        var content = await response.Content.ReadAsStringAsync();
        var tokenData = JsonSerializer.Deserialize<JsonElement>(content);

        return tokenData.GetProperty("access_token").GetString();
    }
}

[ApiController]
[Route("paypal-api")]
public class PayPalTokenController : ControllerBase
{
    private readonly string _paypalBase = Environment.GetEnvironmentVariable("PAYPAL_BASE") ?? "https://api-m.sandbox.paypal.com";
    private readonly string _clientId = Environment.GetEnvironmentVariable("PAYPAL_CLIENT_ID");
    private readonly string _clientSecret = Environment.GetEnvironmentVariable("PAYPAL_CLIENT_SECRET");
    private readonly HttpClient _httpClient;

    public PayPalTokenController(IHttpClientFactory httpClientFactory)
    {
        _httpClient = httpClientFactory.CreateClient();
    }

    // Only this action is intended to be reachable over HTTP. It returns the
    // browser-safe sdk_init token, never the reusable client_credentials bearer.
    [HttpGet("auth/browser-safe-client-token")]
    public async Task<IActionResult> GetBrowserSafeClientToken()
    {
        try
        {
            var auth = Convert.ToBase64String(Encoding.UTF8.GetBytes($"{_clientId}:{_clientSecret}"));

            var request = new HttpRequestMessage(HttpMethod.Post, $"{_paypalBase}/v1/oauth2/token");
            request.Headers.Authorization = new AuthenticationHeaderValue("Basic", auth);
            request.Content = new StringContent(
                "grant_type=client_credentials&response_type=client_token&intent=sdk_init",
                Encoding.UTF8,
                "application/x-www-form-urlencoded"
            );

            var response = await _httpClient.SendAsync(request);
            var content = await response.Content.ReadAsStringAsync();
            var tokenData = JsonSerializer.Deserialize<JsonElement>(content);

            return Ok(new
            {
                accessToken = tokenData.GetProperty("access_token").GetString(),
                expiresIn = tokenData.GetProperty("expires_in").GetInt32()
            });
        }
        catch
        {
            return StatusCode(500, new { error = "TOKEN_GENERATION_FAILED" });
        }
    }
}
```

#### Register the token service (Program.cs)

```csharp
builder.Services.AddHttpClient();
builder.Services.AddSingleton<IPayPalTokenService, PayPalTokenService>();
```

If `Program.cs` uses top-level statements (the .NET 6+ minimal hosting style), add this line at the end of the file so the test project below can reference the app:

```csharp
public partial class Program { }
```

#### Regression tests

Add this test class (e.g. `PayPalTokenControllerSecurityTests.cs` in an xUnit test project referencing `Microsoft.AspNetCore.Mvc.Testing`) so a future regression — such as someone re-adding a public helper directly to the controller — fails CI instead of shipping:

```csharp
using System.Linq;
using System.Net;
using System.Reflection;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Routing;
using Microsoft.AspNetCore.Mvc.Testing;
using Xunit;

public class PayPalTokenControllerSecurityTests : IClassFixture<WebApplicationFactory<Program>>
{
    private readonly HttpClient _client;

    public PayPalTokenControllerSecurityTests(WebApplicationFactory<Program> factory)
    {
        _client = factory.CreateClient();
    }

    // 1. Endpoint-enumeration test: every public method on the controller must be
    //    either an explicit HTTP action — any verb, via IActionHttpMethodProvider,
    //    which HttpGet/HttpPost/HttpPut/HttpDelete/HttpPatch/HttpHead/AcceptVerbs all
    //    implement — or [NonAction]. Nothing is left implicit.
    [Fact]
    public void TokenController_HasNoImplicitPublicActions()
    {
        var actionMethods = typeof(PayPalTokenController)
            .GetMethods(BindingFlags.Public | BindingFlags.Instance | BindingFlags.DeclaredOnly)
            .Where(m => !m.IsSpecialName);

        Assert.All(actionMethods, m =>
            Assert.True(
                m.GetCustomAttributes().OfType<IActionHttpMethodProvider>().Any() ||
                m.GetCustomAttribute<NonActionAttribute>() != null,
                $"{m.Name} is publicly reachable as a controller action without an explicit HTTP verb attribute or [NonAction]."));
    }

    // 2. Unauthenticated request test: the bare controller route (no sub-path)
    //    must not resolve to any action.
    [Fact]
    public async Task GetPayPalApiRoot_ReturnsNotFound()
    {
        var response = await _client.GetAsync("/paypal-api");
        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }
}
```
