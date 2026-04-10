# Braintree transaction — `TransactionRequest`, `sale`, void, refund

Charge a **payment method nonce** from Drop-in or Hosted Fields with **`gateway.transaction().sale()`**. Use **`Result.isSuccess()`** before trusting **`getTarget()`**. Void unsettled captures; refund settled amounts.

## Sale (authorize + capture)

```java
import com.braintreegateway.BraintreeGateway;
import com.braintreegateway.Result;
import com.braintreegateway.Transaction;
import com.braintreegateway.TransactionRequest;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

import java.math.BigDecimal;
import java.util.Map;

@RestController
public class BraintreeCheckoutController {

  private final BraintreeGateway gateway;

  public BraintreeCheckoutController(BraintreeGateway gateway) {
    this.gateway = gateway;
  }

  @PostMapping("/api/braintree/checkout")
  public ResponseEntity<?> sale(@RequestBody Map<String, String> body) {
    String nonce = body.get("payment_method_nonce");

    TransactionRequest request =
        new TransactionRequest()
            .amount(new BigDecimal("49.99"))
            .paymentMethodNonce(nonce)
            .options()
            .submitForSettlement(true)
            .done();

    Result<Transaction> result = gateway.transaction().sale(request);

    if (!result.isSuccess()) {
      return ResponseEntity.badRequest().body(Map.of("error", result.getMessage()));
    }

    Transaction tx = result.getTarget();
    return ResponseEntity.ok(
        Map.of(
            "transaction_id", tx.getId(),
            "status", tx.getStatus().toString()));
  }
}
```

## Authorize only (capture later)

```java
    TransactionRequest request =
        new TransactionRequest()
            .amount(new BigDecimal("49.99"))
            .paymentMethodNonce(nonce)
            .options()
            .submitForSettlement(false)
            .done();
```

Then capture:

```java
Result<Transaction> captureResult =
    gateway.transaction().submitForSettlement(transactionId, new BigDecimal("49.99"));
```

## Void (unsettled / authorized)

```java
import com.braintreegateway.Result;
import com.braintreegateway.Transaction;

Result<Transaction> voidResult = gateway.transaction().voidTransaction(transactionId);
if (!voidResult.isSuccess()) {
  // log voidResult.getMessage()
}
```

## Refund

Full refund:

```java
Result<Transaction> refundResult = gateway.transaction().refund(transactionId);
```

Partial:

```java
Result<Transaction> partial =
    gateway.transaction().refund(transactionId, new BigDecimal("10.00"));
```

## Related

- `braintree-vault.md` — customer + vaulted payment method charges.
- `error-handling.md` — declines, processor codes, validations.
