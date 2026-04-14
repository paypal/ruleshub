#### Complete ASP.NET Core Application

```csharp
using Microsoft.AspNetCore.Builder;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddCors(options =>
{
    options.AddPolicy("PayPalPolicy", policy =>
    {
        policy.AllowAnyOrigin()
              .AllowAnyMethod()
              .WithHeaders("Content-Type", "Authorization", "PayPal-Request-Id");
    });
});

builder.Services.AddControllers();
builder.Services.AddHttpClient();
builder.Services.AddSingleton<PayPalTokenController>();

var app = builder.Build();

app.UseCors("PayPalPolicy");
app.MapControllers();

app.Run();
```

#### Complete Controller

```csharp
using Microsoft.AspNetCore.Mvc;
using System.Net.Http;
using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;

[ApiController]
[Route("paypal-api")]
public class PayPalController : ControllerBase
{
    private readonly string _paypalBase = Environment.GetEnvironmentVariable("PAYPAL_BASE") ?? "https://api-m.sandbox.paypal.com";
    private readonly string _clientId = Environment.GetEnvironmentVariable("PAYPAL_CLIENT_ID");
    private readonly string _clientSecret = Environment.GetEnvironmentVariable("PAYPAL_CLIENT_SECRET");
    private readonly HttpClient _httpClient;

    public PayPalController(IHttpClientFactory httpClientFactory)
    {
        _httpClient = httpClientFactory.CreateClient();
    }

    private async Task<string> GetAccessToken()
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
            
            return Ok(new { accessToken = tokenData.GetProperty("access_token").GetString() });
        }
        catch
        {
            return StatusCode(500, new { error = "TOKEN_GENERATION_FAILED" });
        }
    }

    [HttpPost("checkout/orders/create")]
    public async Task<IActionResult> CreateOrder([FromBody] JsonElement requestBody)
    {
        try
        {
            var accessToken = await GetAccessToken();
            var paypalRequestId = Request.Headers.ContainsKey("PayPal-Request-Id")
                ? Request.Headers["PayPal-Request-Id"].ToString()
                : Guid.NewGuid().ToString();
            
            var request = new HttpRequestMessage(HttpMethod.Post, $"{_paypalBase}/v2/checkout/orders");
            request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", accessToken);
            request.Headers.Add("PayPal-Request-Id", paypalRequestId);
            request.Content = new StringContent(
                JsonSerializer.Serialize(requestBody),
                Encoding.UTF8,
                "application/json"
            );
            
            var response = await _httpClient.SendAsync(request);
            var content = await response.Content.ReadAsStringAsync();
            
            return StatusCode((int)response.StatusCode, JsonSerializer.Deserialize<object>(content));
        }
        catch
        {
            return StatusCode(500, new { error = "ORDER_CREATION_FAILED" });
        }
    }

    [HttpPost("checkout/orders/{orderId}/capture")]
    public async Task<IActionResult> CaptureOrder(string orderId)
    {
        try
        {
            var accessToken = await GetAccessToken();
            
            var request = new HttpRequestMessage(HttpMethod.Post, 
                $"{_paypalBase}/v2/checkout/orders/{orderId}/capture");
            request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", accessToken);
            request.Headers.Add("PayPal-Request-Id", Guid.NewGuid().ToString());
            request.Content = new StringContent("{}", Encoding.UTF8, "application/json");
            
            var response = await _httpClient.SendAsync(request);
            var content = await response.Content.ReadAsStringAsync();
            
            return Ok(JsonSerializer.Deserialize<object>(content));
        }
        catch
        {
            return StatusCode(500, new { error = "CAPTURE_FAILED" });
        }
    }
}
```

#### Environment Variables (appsettings.json)

```json
{
  "Logging": {
    "LogLevel": {
      "Default": "Information",
      "Microsoft.AspNetCore": "Warning"
    }
  },
  "AllowedHosts": "*"
}
```

#### Environment Variables (User Secrets or .env)

```bash
export PAYPAL_CLIENT_ID=your_client_id_here
export PAYPAL_CLIENT_SECRET=your_client_secret_here
export PAYPAL_BASE=https://api-m.sandbox.paypal.com
```

#### Project File (csproj)

```xml
<Project Sdk="Microsoft.NET.Sdk.Web">
  <PropertyGroup>
    <TargetFramework>net6.0</TargetFramework>
    <Nullable>enable</Nullable>
    <ImplicitUsings>enable</ImplicitUsings>
  </PropertyGroup>

  <ItemGroup>
    <PackageReference Include="Microsoft.AspNetCore.Cors" Version="2.2.0" />
  </ItemGroup>
</Project>
```

