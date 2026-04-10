# 3D Secure — client 3DS + server `ThreeDSecureInfo` check

Use **Braintree 3D Secure** on the client (Drop-in with 3DS, or **`threeDSecure`** component with Hosted Fields) so the issuer can step up authentication. On the server, inspect **`Transaction.ThreeDSecureInfo`** after **`Transaction.Sale`**.

## Client — Drop-in with 3DS (concept)

Enable 3DS in **`dropin.create`** options (exact keys per current Braintree JS — e.g. **`threeDSecure`** block with **`amount`**). Complete the liability shift / challenge in the browser; the nonce you send to the server reflects the authenticated flow when configured.

```javascript
braintree.dropin.create({
  authorization: clientToken,
  container: '#dropin-container',
  threeDSecure: {
    amount: '49.99',
    // email, billingAddress, additionalInformation — per Braintree 3DS guide
  },
}, function (createErr, dropinInstance) { /* ... */ });
```

After **`requestPaymentMethod`**, POST **`payload.nonce`** to your ASP.NET Core endpoint.

## Server — sale + `ThreeDSecureInfo`

```csharp
using Braintree;

namespace YourApp.Braintree;

public sealed class ThreeDSecureService
{
    private readonly BraintreeGateway _gateway;

    public ThreeDSecureService(BraintreeGateway gateway) => _gateway = gateway;

    public Result<Transaction> SaleWithThreeDSCheck(string nonce)
    {
        var request = new TransactionRequest
        {
            Amount = 49.99M,
            PaymentMethodNonce = nonce,
            Options = new TransactionOptionsRequest
            {
                SubmitForSettlement = true,
            },
        };

        Result<Transaction> result = _gateway.Transaction.Sale(request);
        if (!result.IsSuccess())
            return result;

        Transaction tx = result.Target;
        ThreeDSecureInfo? info = tx.ThreeDSecureInfo;

        if (info != null)
        {
            bool liabilityShifted = info.LiabilityShifted == true;
            if (!liabilityShifted)
            {
                // Your policy: void, manual review, or allow per risk rules
            }
        }

        return result;
    }
}
```

## Operational notes

- Align **amount** and **currency** on the client 3DS config with the server **`TransactionRequest` amount**.
- If 3DS is required and not completed, **`Sale`** may fail or return a non-liability-shifted outcome — map per your fraud policy (`error-handling.md`).

## Related

- `braintree-transaction.md` — void/refund after sale.
- Braintree 3DS guide: https://developer.paypal.com/braintree/docs/guides/3d-secure/
