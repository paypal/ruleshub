# Braintree transaction — `TransactionRequest`, `Sale`, `Void`, `Refund`

Charge a **payment method nonce** from Drop-in or Hosted Fields with **`gateway.Transaction.Sale()`**. Check **`result.IsSuccess()`** before trusting **`result.Target`**. Void unsettled captures; refund settled amounts.

## Sale (authorize + capture)

```csharp
using Braintree;
using Microsoft.AspNetCore.Mvc;

namespace YourApp.Controllers;

[ApiController]
[Route("api/braintree")]
public sealed class BraintreeCheckoutController : ControllerBase
{
    private readonly BraintreeGateway _gateway;

    public BraintreeCheckoutController(BraintreeGateway gateway) => _gateway = gateway;

    public sealed class CheckoutBody
    {
        public string? PaymentMethodNonce { get; set; }
    }

    [HttpPost("checkout")]
    public ActionResult<object> Sale([FromBody] CheckoutBody body)
    {
        var nonce = body.PaymentMethodNonce;
        if (string.IsNullOrWhiteSpace(nonce))
            return BadRequest(new { error = "payment_method_nonce required" });

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
            return BadRequest(new { error = result.Message });

        var tx = result.Target;
        return Ok(new { transaction_id = tx.Id, status = tx.Status.ToString() });
    }
}
```

## Authorize only (capture later)

```csharp
        var request = new TransactionRequest
        {
            Amount = 49.99M,
            PaymentMethodNonce = nonce,
            Options = new TransactionOptionsRequest
            {
                SubmitForSettlement = false,
            },
        };
```

Then capture:

```csharp
Result<Transaction> captureResult = _gateway.Transaction.SubmitForSettlement(transactionId, 49.99M);
```

## Void (unsettled / authorized)

```csharp
Result<Transaction> voidResult = _gateway.Transaction.Void(transactionId);
if (!voidResult.IsSuccess())
{
    // log voidResult.Message
}
```

## Refund

Full refund:

```csharp
Result<Transaction> refundResult = _gateway.Transaction.Refund(transactionId);
```

Partial:

```csharp
Result<Transaction> partial = _gateway.Transaction.Refund(transactionId, 10.00M);
```

## Related

- `braintree-vault.md` — customer + vaulted payment method charges.
- `error-handling.md` — declines, processor codes, validations.
