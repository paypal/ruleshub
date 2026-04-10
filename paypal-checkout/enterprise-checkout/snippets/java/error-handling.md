# Error handling — `BraintreeException`, processor declines, `@ControllerAdvice`

Centralize API errors so clients get **safe, consistent JSON** while logs retain **Braintree transaction ids**, **`processor_response_*`**, and PayPal **`paypal-debug-id`** / **`details`**.

## Braintree — `Result` failures vs exceptions

Most Braintree calls return **`Result<T>`** with **`isSuccess()`**. When **`false`**, use **`getMessage()`**, **`getErrors()`**, and (for transactions) **`getTransaction()`** for decline metadata.

**`BraintreeException`** (and subclasses under **`com.braintreegateway.exceptions`**) can be thrown for network/API faults — catch at the boundary and map to **502** / **503** with internal logging, not raw messages to buyers.

### Processor declines (`processor_response_code` / `processor_response_text`)

Typical **2000–2999** issuer/processor codes: insufficient funds, do not honor, etc. Log **`transaction.getId()`**, codes, and text server-side; return a **generic** payment-failed message unless you maintain a curated, user-safe mapping.

```java
import com.braintreegateway.Result;
import com.braintreegateway.Transaction;

import java.util.Optional;

public final class BraintreeResultDiagnostics {

  private BraintreeResultDiagnostics() {}

  public static void logTransactionFailure(Result<Transaction> result) {
    Transaction tx = result.getTransaction();
    String txId = tx != null ? tx.getId() : null;
    String processorCode = tx != null ? tx.getProcessorResponseCode() : null;
    String processorText = tx != null ? tx.getProcessorResponseText() : null;
    String gatewayReject = tx != null ? tx.getGatewayRejectionReason() : null;
    // logger: result.getMessage(), txId, processorCode, processorText, gatewayReject
  }
}
```

### Gateway rejections (`gateway_rejection_reason`)

Risk, AVS/CVV policy, or other gateway-side rejections — treat like hard declines for UX; investigate in Braintree Control Panel with **transaction id**.

### Validation / deep errors

On **`customer().create`**, **`paymentMethod().create`**, etc., iterate **`result.getErrors().getAllDeepValidationErrors()`** (or **`getErrors()`**) for field-level issues — expose only **non-sensitive** messages to the client.

## Spring — `@ControllerAdvice` for Braintree + REST

```java
import com.braintreegateway.exceptions.BraintreeException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ControllerAdvice;
import org.springframework.web.bind.annotation.ExceptionHandler;

import java.util.Map;

@ControllerAdvice
public class PaymentExceptionHandler {

  @ExceptionHandler(BraintreeException.class)
  public ResponseEntity<Map<String, String>> braintree(BraintreeException ex) {
    // Log ex.getMessage() + stack server-side; never echo raw processor text
    return ResponseEntity.status(HttpStatus.BAD_GATEWAY)
        .body(Map.of("error", "payment_provider_error", "message", "Unable to complete payment. Try again."));
  }
}
```

Map **`AuthorizationException`**, **`NotFoundException`**, etc., to appropriate HTTP status codes per your API contract.

## REST-style handler for `Result` failures (optional)

```java
import com.braintreegateway.Result;
import org.springframework.http.ResponseEntity;

import java.util.Map;

public final class BraintreeResponses {

  private BraintreeResponses() {}

  public static <T> ResponseEntity<?> fromResult(Result<T> result) {
    if (result.isSuccess()) {
      return ResponseEntity.ok(result.getTarget());
    }
    return ResponseEntity.badRequest()
        .body(
            Map.of(
                "error", "braintree_request_failed",
                "message", safeMessage(result.getMessage())));
  }

  private static String safeMessage(String raw) {
    return raw == null ? "Request failed" : raw;
  }
}
```

Tighten **`safeMessage()`** in production to avoid leaking internal strings.

## Multiparty / PayPal REST (`HttpClient`)

- **401** — refresh OAuth; verify credentials and **sandbox vs production** base URL (`https://api-m.sandbox.paypal.com` vs `https://api-m.paypal.com`).
- **403** — scopes / partner permissions.
- **422** — read JSON **`details`** (e.g. platform fee validation).
- Always log response header **`paypal-debug-id`** on non-2xx responses.

```java
import java.net.http.HttpResponse;

public final class PayPalErrorLogging {

  private PayPalErrorLogging() {}

  public static void logIfError(HttpResponse<String> response) {
    if (response.statusCode() / 100 == 2) {
      return;
    }
    String debugId = response.headers().firstValue("paypal-debug-id").orElse("");
    // logger: status, debugId, body
  }
}
```

## Client vs server messaging

- **Server** decides retryability; **client** shows a generic failure plus an optional **support reference** (correlation id), not raw processor codes in production unless curated.

## Related

- `braintree-transaction.md` — sale, void, refund.
- `multiparty-create-order.md` / `multiparty-capture.md` — Orders and capture errors.
- `webhooks.md` — async reconciliation.
