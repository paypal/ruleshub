# Hosted Fields — client JS + Razor (Braintree Direct)

Use **Hosted Fields** when you need a custom layout while keeping PAN data out of your PCI scope. Initialize **`braintree.client`** and **`braintree.hostedFields`** with the **`client_token`**.

## Razor Page — `Pages/CheckoutHosted.cshtml`

```cshtml
@page
@model CheckoutHostedModel
@{
    ViewData["Title"] = "Checkout — Hosted Fields";
}

@section Head {
    <script src="https://js.braintreegateway.com/web/3.97.1/js/client.min.js"></script>
    <script src="https://js.braintreegateway.com/web/3.97.1/js/hosted-fields.min.js"></script>
    <style>
        .hf { height: 40px; border: 1px solid #ccc; border-radius: 4px; padding: 0 8px; }
        label { display: block; margin-top: 12px; font-weight: 600; }
    </style>
}

<h1>Card payment</h1>
<form id="payment-form" action="#" method="post">
    <label for="card-number">Card number</label>
    <div id="card-number" class="hf"></div>
    <label for="cvv">CVV</label>
    <div id="cvv" class="hf"></div>
    <label for="expiration-date">Expiration</label>
    <div id="expiration-date" class="hf"></div>
    <button id="submit" type="submit">Pay</button>
</form>

@section Scripts {
    <script>
        const authorization = @Html.Raw(System.Text.Json.JsonSerializer.Serialize(Model.ClientToken));

        braintree.client.create({ authorization: authorization }, function (clientErr, clientInstance) {
            if (clientErr) {
                console.error(clientErr);
                return;
            }

            braintree.hostedFields.create({
                client: clientInstance,
                styles: {
                    input: { 'font-size': '16px' },
                    '.invalid': { color: 'red' },
                },
                fields: {
                    number: { selector: '#card-number' },
                    cvv: { selector: '#cvv' },
                    expirationDate: { selector: '#expiration-date', placeholder: 'MM / YY' },
                },
            }, function (hostedFieldsErr, hostedFieldsInstance) {
                if (hostedFieldsErr) {
                    console.error(hostedFieldsErr);
                    return;
                }

                document.querySelector('#payment-form').addEventListener('submit', function (e) {
                    e.preventDefault();
                    hostedFieldsInstance.tokenize(function (tokenizeErr, payload) {
                        if (tokenizeErr) {
                            console.error(tokenizeErr);
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
        });
    </script>
}
```

## Page model — same pattern as Drop-in

```csharp
using Braintree;
using Microsoft.AspNetCore.Mvc.RazorPages;

namespace YourApp.Pages;

public sealed class CheckoutHostedModel : PageModel
{
    private readonly BraintreeGateway _gateway;

    public CheckoutHostedModel(BraintreeGateway gateway) => _gateway = gateway;

    public string ClientToken { get; private set; } = "";

    public void OnGet() => ClientToken = _gateway.ClientToken.Generate();
}
```

## Related

- `braintree-transaction.md` — `Transaction.Sale` with the nonce.
- `braintree-3d-secure.md` — add 3DS when required.
