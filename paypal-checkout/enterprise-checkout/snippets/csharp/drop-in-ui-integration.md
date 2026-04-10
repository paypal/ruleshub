# Drop-in UI — client JS + Razor (Braintree Direct)

Load **Drop-in** in the browser using the **`client_token`** from `braintree-client-token.md`. Use the **sandbox** Braintree JS CDN in development; switch script URL for production per [Braintree Drop-in](https://developer.paypal.com/braintree/docs/guides/drop-in/).

## Razor Page — `Pages/CheckoutDropIn.cshtml`

```cshtml
@page
@model CheckoutDropInModel
@{
    ViewData["Title"] = "Checkout — Drop-in";
}

@section Head {
    <script src="https://js.braintreegateway.com/web/dropin/1.44.1/js/dropin.min.js"></script>
}

<h1>Pay with card or wallet</h1>
<div id="dropin-container"></div>
<button id="submit-button" type="button" disabled>Pay</button>

@section Scripts {
    <script>
        const clientToken = @Html.Raw(System.Text.Json.JsonSerializer.Serialize(Model.ClientToken));

        braintree.dropin.create({
            authorization: clientToken,
            container: '#dropin-container',
            // vaultManager: true, // if using customer_id in client token
        }, function (createErr, dropinInstance) {
            if (createErr) {
                console.error(createErr);
                return;
            }
            document.querySelector('#submit-button').disabled = false;

            document.querySelector('#submit-button').addEventListener('click', function () {
                dropinInstance.requestPaymentMethod(function (err, payload) {
                    if (err) {
                        console.error(err);
                        return;
                    }
                    fetch('/api/braintree/checkout', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ payment_method_nonce: payload.nonce }),
                    }).then(function (r) { return r.json(); }).then(console.log).catch(console.error);
                });
            });
        });
    </script>
}
```

## Page model — `Pages/CheckoutDropIn.cshtml.cs`

```csharp
using Braintree;
using Microsoft.AspNetCore.Mvc.RazorPages;

namespace YourApp.Pages;

public sealed class CheckoutDropInModel : PageModel
{
    private readonly BraintreeGateway _gateway;

    public CheckoutDropInModel(BraintreeGateway gateway) => _gateway = gateway;

    public string ClientToken { get; private set; } = "";

    public void OnGet()
    {
        ClientToken = _gateway.ClientToken.Generate();
    }
}
```

Alternatively, fetch JSON from **`GET /api/braintree/client-token`** instead of embedding the token in the page model.

## Related

- `hosted-fields-integration.md` — custom card fields instead of Drop-in.
- `braintree-transaction.md` — charge the nonce on the server.
