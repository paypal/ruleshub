# Error handling — PayPal Expanded Checkout (Spring Boot / Java)

Expanded Checkout adds **card declines**, **3D Secure** failures, and **issuer** challenges on top of general REST errors. Use **`PayPal-Debug-Id`** from response headers when contacting PayPal support.

**REST bases:** Sandbox `https://api-m.sandbox.paypal.com`, Production `https://api-m.paypal.com`.

## Card declines

- **Instrument / funding:** Buyer may need another card or payment method; surface a generic message.
- **Risk / review:** Orders may remain non-capturable until review completes — align with `PAYMENT.CAPTURE.PENDING` webhooks.
- Parse PayPal error JSON (`name`, `message`, `details`) server-side; log full body with **`PayPal-Debug-Id`**, not raw bodies to the browser.

```java
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;

public final class PayPalErrorParser {
  private static final ObjectMapper M = new ObjectMapper();

  private PayPalErrorParser() {}

  public static String summary(String responseBody) throws Exception {
    JsonNode n = M.readTree(responseBody);
    return n.path("message").asText(n.path("name").asText("error"));
  }
}
```

## 3DS errors

- Missing or invalid **`payment_source.card.experience_context`** (return/cancel URLs) often breaks challenge flows — see `3ds-integration.md`.
- After a failed challenge, do not capture; create a new order if the buyer retries.

## `PayPalApiException` and Debug ID

```java
import java.net.http.HttpHeaders;
import java.util.Optional;

public class PayPalApiException extends RuntimeException {

  private final int statusCode;
  private final String responseBody;
  private final Optional<String> debugId;

  public PayPalApiException(int statusCode, String responseBody, HttpHeaders headers) {
    super("PayPal API HTTP " + statusCode);
    this.statusCode = statusCode;
    this.responseBody = responseBody;
    this.debugId = headers == null ? Optional.empty() : headers.firstValue("PayPal-Debug-Id");
  }

  public int getStatusCode() { return statusCode; }
  public String getResponseBody() { return responseBody; }
  public Optional<String> getDebugId() { return debugId; }
}
```

## Spring `@ControllerAdvice`

```java
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

import java.util.Map;

@RestControllerAdvice
public class ExpandedCheckoutExceptionHandlers {

  private static final Logger log = LoggerFactory.getLogger(ExpandedCheckoutExceptionHandlers.class);

  @ExceptionHandler(PayPalApiException.class)
  public ResponseEntity<Map<String, Object>> paypal(PayPalApiException ex) {
    ex.getDebugId().ifPresent(id ->
        log.warn("PayPal error debug_id={} status={} body={}",
            id, ex.getStatusCode(), truncate(ex.getResponseBody(), 2000)));

    HttpStatus status = HttpStatus.BAD_GATEWAY;
    if (ex.getStatusCode() >= 400 && ex.getStatusCode() < 500) {
      status = HttpStatus.BAD_REQUEST;
    }

    return ResponseEntity.status(status).body(Map.of(
        "error", "payment_failed",
        "paypal_debug_id", ex.getDebugId().orElse("")
    ));
  }

  private static String truncate(String s, int max) {
    if (s == null) return "";
    return s.length() <= max ? s : s.substring(0, max) + "...";
  }
}
```

## Operational notes

- Correlate your **`PayPal-Request-Id`** with PayPal logs when debugging duplicate or missing captures.
- See [Card decline errors](https://developer.paypal.com/docs/checkout/advanced/card-decline-errors/) for issuer-oriented messaging guidance.
