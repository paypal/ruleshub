#### Fastlane - Create Order with Single-Use Token

```csharp
using Microsoft.AspNetCore.Mvc;
using System.Net.Http;
using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;

[ApiController]
[Route("paypal-api/checkout/orders")]
public class FastlaneOrderController : ControllerBase
{
    private readonly string _paypalBase = Environment.GetEnvironmentVariable("PAYPAL_BASE") ?? "https://api-m.sandbox.paypal.com";
    private readonly HttpClient _httpClient;
    private readonly PayPalTokenController _tokenController;

    public FastlaneOrderController(IHttpClientFactory httpClientFactory, PayPalTokenController tokenController)
    {
        _httpClient = httpClientFactory.CreateClient();
        _tokenController = tokenController;
    }

    [HttpPost("create")]
    public async Task<IActionResult> CreateFastlaneOrder([FromBody] JsonElement requestBody)
    {
        try
        {
            var accessToken = await _tokenController.GetAccessToken();
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
}
```

#### CORS Configuration (Startup.cs or Program.cs)

```csharp
public void ConfigureServices(IServiceCollection services)
{
    services.AddCors(options =>
    {
        options.AddPolicy("PayPalPolicy", builder =>
        {
            builder.AllowAnyOrigin()
                   .AllowAnyMethod()
                   .WithHeaders("Content-Type", "Authorization", "PayPal-Request-Id");
        });
    });
    
    services.AddControllers();
    services.AddHttpClient();
}

public void Configure(IApplicationBuilder app, IWebHostEnvironment env)
{
    app.UseCors("PayPalPolicy");
    app.UseRouting();
    app.UseEndpoints(endpoints => { endpoints.MapControllers(); });
}
```

#### CORS Configuration (.NET 6+)

```csharp
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

var app = builder.Build();

app.UseCors("PayPalPolicy");
app.MapControllers();
app.Run();
```

