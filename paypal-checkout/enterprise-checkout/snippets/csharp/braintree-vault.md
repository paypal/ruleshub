# Braintree vault — `CustomerRequest`, `Customer.Create`, `PaymentMethod.Create`

Create a **customer**, vault a **nonce** as a **payment method**, then charge **`PaymentMethodToken`** for repeat purchases without re-collecting the card.

## `BraintreeVaultController` — create customer, vault nonce, charge token

```csharp
using Braintree;
using Microsoft.AspNetCore.Mvc;

namespace YourApp.Controllers;

[ApiController]
[Route("api/braintree")]
public sealed class BraintreeVaultController : ControllerBase
{
    private readonly BraintreeGateway _gateway;

    public BraintreeVaultController(BraintreeGateway gateway) => _gateway = gateway;

    public sealed class CreateCustomerBody
    {
        public string? FirstName { get; set; }
        public string? LastName { get; set; }
        public string? Email { get; set; }
    }

    [HttpPost("customers")]
    public ActionResult<object> CreateCustomer([FromBody] CreateCustomerBody body)
    {
        var request = new CustomerRequest
        {
            FirstName = body.FirstName,
            LastName = body.LastName,
            Email = body.Email,
        };

        Result<Customer> result = _gateway.Customer.Create(request);
        if (!result.IsSuccess())
            return BadRequest(new { error = result.Message });

        return Ok(new { customer_id = result.Target.Id });
    }

    public sealed class VaultNonceBody
    {
        public string? CustomerId { get; set; }
        public string? PaymentMethodNonce { get; set; }
    }

    [HttpPost("payment-methods")]
    public ActionResult<object> VaultNonce([FromBody] VaultNonceBody body)
    {
        var pmRequest = new PaymentMethodRequest
        {
            CustomerId = body.CustomerId,
            PaymentMethodNonce = body.PaymentMethodNonce,
        };

        var pmResult = _gateway.PaymentMethod.Create(pmRequest);
        if (!pmResult.IsSuccess())
            return BadRequest(new { error = pmResult.Message });

        return Ok(new { token = pmResult.Target.Token });
    }

    public Result<Transaction> ChargeSavedToken(string paymentMethodToken, decimal amount)
    {
        var request = new TransactionRequest
        {
            Amount = amount,
            PaymentMethodToken = paymentMethodToken,
            Options = new TransactionOptionsRequest
            {
                SubmitForSettlement = true,
            },
        };

        return _gateway.Transaction.Sale(request);
    }
}
```

## Optional — `Customer.Find`

`Find` returns a **`Customer`** or throws **`NotFoundException`** if the id does not exist.

```csharp
using Braintree.Exceptions;

try
{
    Customer customer = _gateway.Customer.Find(customerId);
    _ = customer.Id;
}
catch (NotFoundException)
{
    // handle missing customer
}
```

## Client token with `customer_id`

See `braintree-client-token.md` — pass **`CustomerId`** into **`ClientTokenRequest`** so Drop-in can show saved methods.

## Related

- `braintree-transaction.md` — void/refund patterns.
- `braintree-3d-secure.md` — vaulted + SCA flows when applicable.
