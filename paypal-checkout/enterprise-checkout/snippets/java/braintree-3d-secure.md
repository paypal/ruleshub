# 3D Secure — client 3DS + server `ThreeDSecureInfo` check

Use **Braintree 3D Secure** on the client (Drop-in with 3DS, or **`threeDSecure`** component with Hosted Fields) so the issuer can step up authentication. On the server, inspect **`Transaction.getThreeDSecureInfo()`** after **`transaction().sale()`**.

## Client — Drop-in with 3DS (concept)

Enable 3DS in **`dropin.create`** options (exact keys per current Braintree JS version — e.g. **`threeDSecure: true`** and optional **`threeDSecure` configuration**). Complete the liability shift / challenge in the browser; the nonce you send to the server reflects the authenticated flow when configured.

```javascript
braintree.dropin.create({
  authorization: clientToken,
  container: '#dropin-container',
  threeDSecure: {
    amount: '49.99',
    // email, billingAddress, additionalInformation — per Braintree 3DS guide
  },
}, function (err, dropinInstance) { /* ... */ });
```

After **`requestPaymentMethod`**, POST **`payload.nonce`** to your Spring endpoint.

## Server — sale + `ThreeDSecureInfo`

```java
import com.braintreegateway.BraintreeGateway;
import com.braintreegateway.Result;
import com.braintreegateway.ThreeDSecureInfo;
import com.braintreegateway.Transaction;
import com.braintreegateway.TransactionRequest;

import java.math.BigDecimal;

public class ThreeDSecureService {

  private final BraintreeGateway gateway;

  public ThreeDSecureService(BraintreeGateway gateway) {
    this.gateway = gateway;
  }

  public Result<Transaction> saleWithThreeDSCheck(String nonce) {
    TransactionRequest request =
        new TransactionRequest()
            .amount(new BigDecimal("49.99"))
            .paymentMethodNonce(nonce)
            .options()
            .submitForSettlement(true)
            .done();

    Result<Transaction> result = gateway.transaction().sale(request);
    if (!result.isSuccess()) {
      return result;
    }

    Transaction tx = result.getTarget();
    ThreeDSecureInfo info = tx.getThreeDSecureInfo();

    if (info != null) {
      // liabilityShifted, liabilityShiftPossible, enrolled, status, etc.
      boolean liabilityShifted = Boolean.TRUE.equals(info.getLiabilityShifted());
      if (!liabilityShifted) {
        // Your policy: void, manual review, or allow per risk rules
      }
    }

    return result;
  }
}
```

## Operational notes

- Align **amount** and **currency** on the client 3DS config with the server **`TransactionRequest` amount**.
- If 3DS is required and not completed, **`sale()`** may fail or return a non-liability-shifted outcome — map per your fraud policy (`error-handling.md`).

## Related

- `braintree-transaction.md` — void/refund after sale.
- Braintree 3DS guide: https://developer.paypal.com/braintree/docs/guides/3d-secure/
