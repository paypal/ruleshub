# SDK initialization — Razor + HTML/JS (Expanded Checkout, JS SDK v6)

Load the **JS SDK v6** core script, fetch a **browser-safe client token** from your ASP.NET Core app, then call **`window.paypal.createInstance`** with **`card-fields`** (and other components you need). This snippet shows a **Razor Page** that embeds the script and a minimal checkout shell.

## Script URLs

| Environment | SDK URL |
|-------------|---------|
| Sandbox | `https://www.sandbox.paypal.com/web-sdk/v6/core` |
| Production | `https://www.paypal.com/web-sdk/v6/core` |

## `Pages/CheckoutExpanded.cshtml`

```cshtml
@page
@model CheckoutExpandedModel
@{
    ViewData["Title"] = "Checkout";
}

@section Head {
    <script src="https://www.sandbox.paypal.com/web-sdk/v6/core"></script>
}

<div class="checkout-expanded">
    <h1>Pay</h1>
    <div id="card-fields-container"></div>
    <div id="paypal-buttons"></div>
</div>

@section Scripts {
    <script type="module">
        async function getClientToken() {
            const res = await fetch('/paypal-api/auth/browser-safe-client-token', { credentials: 'same-origin' });
            if (!res.ok) throw new Error('client token failed');
            const data = await res.json();
            return data.accessToken;
        }

        const accessToken = await getClientToken();

        const sdkInstance = await window.paypal.createInstance({
            clientId: '@Model.PayPalClientId',
            components: ['paypal-payments', 'card-fields'],
            pageType: 'checkout',
            auth: async () => ({ accessToken })
        });

        // Card fields + buttons wiring continues in card-fields-integration.md
        console.log('PayPal SDK instance ready', sdkInstance);
    </script>
}
```

## `Pages/CheckoutExpanded.cshtml.cs`

```csharp
using Microsoft.AspNetCore.Mvc.RazorPages;
using Microsoft.Extensions.Options;

namespace YourApp.Pages;

public sealed class CheckoutExpandedModel : PageModel
{
    private readonly PayPalOptions _options;

    public CheckoutExpandedModel(IOptions<PayPalOptions> options) => _options = options.Value;

    public string PayPalClientId => _options.ClientId;

    public void OnGet()
    {
    }
}
```

## `IConfiguration` for public Client ID

Expose only the **Client ID** to the view (it is public in the browser). Keep **ClientSecret** server-only via `PayPalOptions` bound from configuration.

## Production

- Swap the script `src` to `https://www.paypal.com/web-sdk/v6/core`.
- Ensure your ASP.NET Core app uses **`ApiBaseUrl`** against `https://api-m.paypal.com` for REST calls (see prerequisites).

## Related snippets

- **client-token-generation.md** — `/paypal-api/auth/browser-safe-client-token`
- **card-fields-integration.md** — render Card Fields and submit flow
