# Braintree vault — `CustomerRequest`, `customer().create()`, charge saved method

Create a **customer**, vault a **nonce** as a **payment method**, then charge **`paymentMethodToken`** for repeat purchases without re-collecting the card.

## Create customer

```java
import com.braintreegateway.BraintreeGateway;
import com.braintreegateway.Customer;
import com.braintreegateway.CustomerRequest;
import com.braintreegateway.Result;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

@RestController
public class BraintreeVaultController {

  private final BraintreeGateway gateway;

  public BraintreeVaultController(BraintreeGateway gateway) {
    this.gateway = gateway;
  }

  @PostMapping("/api/braintree/customers")
  public ResponseEntity<?> createCustomer(@RequestBody Map<String, String> body) {
    CustomerRequest request =
        new CustomerRequest()
            .firstName(body.getOrDefault("first_name", ""))
            .lastName(body.getOrDefault("last_name", ""))
            .email(body.get("email"));

    Result<Customer> result = gateway.customer().create(request);
    if (!result.isSuccess()) {
      return ResponseEntity.badRequest().body(Map.of("error", result.getMessage()));
    }
    return ResponseEntity.ok(Map.of("customer_id", result.getTarget().getId()));
  }
}
```

## Vault nonce as payment method

```java
import com.braintreegateway.PaymentMethod;
import com.braintreegateway.PaymentMethodRequest;

  @PostMapping("/api/braintree/payment-methods")
  public ResponseEntity<?> vaultNonce(@RequestBody Map<String, String> body) {
    String customerId = body.get("customer_id");
    String nonce = body.get("payment_method_nonce");

    PaymentMethodRequest pmRequest =
        new PaymentMethodRequest().customerId(customerId).paymentMethodNonce(nonce);

    Result<? extends PaymentMethod> result = gateway.paymentMethod().create(pmRequest);
    if (!result.isSuccess()) {
      return ResponseEntity.badRequest().body(Map.of("error", result.getMessage()));
    }

    return ResponseEntity.ok(Map.of("token", result.getTarget().getToken()));
  }
```

## Charge saved payment method

```java
import com.braintreegateway.Transaction;
import com.braintreegateway.TransactionRequest;

import java.math.BigDecimal;

  public Result<Transaction> chargeSavedToken(String paymentMethodToken, BigDecimal amount) {
    TransactionRequest request =
        new TransactionRequest()
            .amount(amount)
            .paymentMethodToken(paymentMethodToken)
            .options()
            .submitForSettlement(true)
            .done();

    return gateway.transaction().sale(request);
  }
```

## Client token with `customer_id`

See `braintree-client-token.md` — pass **`customerId`** into **`ClientTokenRequest`** so Drop-in can show saved methods.

## Related

- `braintree-transaction.md` — void/refund patterns.
- `braintree-3d-secure.md` — vaulted + SCA flows when applicable.
