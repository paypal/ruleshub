# Capture order — PayPal Standard Checkout (Spring Boot / Java)

**App endpoint:** `POST /paypal-api/checkout/orders/{orderId}/capture`  
**PayPal API:** `POST /v2/checkout/orders/{order_id}/capture`

- **Sandbox:** `https://api-m.sandbox.paypal.com/v2/checkout/orders/{order_id}/capture`
- **Production:** `https://api-m.paypal.com/v2/checkout/orders/{order_id}/capture`

Call capture after the buyer approves and the order status allows capture (typically `APPROVED` for `intent: CAPTURE`). Extract the **capture ID** from the response for refunds and reconciliation.

## Request

Optional JSON body for final amount or invoice details; empty body `{}` captures the full authorized amount.

```java
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;

public class PayPalCaptureClient {

  private final HttpClient http = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(10)).build();
  private final ObjectMapper mapper = new ObjectMapper();
  private final String baseUrl;
  private final PayPalTokenProvider tokens;

  public PayPalCaptureClient(String baseUrl, PayPalTokenProvider tokens) {
    this.baseUrl = baseUrl.endsWith("/") ? baseUrl.substring(0, baseUrl.length() - 1) : baseUrl;
    this.tokens = tokens;
  }

  public JsonNode captureOrder(String orderId) throws Exception {
    String path = baseUrl + "/v2/checkout/orders/" + orderId + "/capture";
    HttpRequest request = HttpRequest.newBuilder()
        .uri(URI.create(path))
        .timeout(Duration.ofSeconds(30))
        .header("Authorization", "Bearer " + tokens.getAccessToken())
        .header("Content-Type", "application/json")
        .POST(HttpRequest.BodyPublishers.ofString("{}", StandardCharsets.UTF_8))
        .build();

    HttpResponse<String> response =
        http.send(request, HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8));

    if (response.statusCode() < 200 || response.statusCode() >= 300) {
      throw new PayPalApiException(response.statusCode(), response.body(), response.headers());
    }
    return mapper.readTree(response.body());
  }
}
```

## Extract capture ID

Path in the response: `purchase_units[0].payments.captures[0].id`.

```java
import com.fasterxml.jackson.databind.JsonNode;

public final class CaptureIdExtractor {

  private CaptureIdExtractor() {}

  public static String firstCaptureId(JsonNode orderOrCaptureResponse) {
    JsonNode units = orderOrCaptureResponse.path("purchase_units");
    if (!units.isArray() || units.isEmpty()) return null;
    JsonNode captures = units.get(0).path("payments").path("captures");
    if (!captures.isArray() || captures.isEmpty()) return null;
    return captures.get(0).path("id").asText(null);
  }
}
```

## Spring Boot controller

```java
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.regex.Pattern;

@RestController
@RequestMapping("/paypal-api/checkout/orders")
public class PayPalCaptureController {

  private static final Pattern ORDER_ID = Pattern.compile("^[A-Z0-9]+$");

  private final PayPalCaptureClient captureClient;
  private final ObjectMapper mapper = new ObjectMapper();

  public PayPalCaptureController(PayPalCaptureClient captureClient) {
    this.captureClient = captureClient;
  }

  @PostMapping("/{orderId}/capture")
  public ResponseEntity<JsonNode> capture(@PathVariable String orderId) throws Exception {
    if (orderId == null || orderId.isBlank() || !ORDER_ID.matcher(orderId).matches()) {
      throw new IllegalArgumentException("invalid orderId");
    }
    JsonNode body = captureClient.captureOrder(orderId);

    ObjectNode summary = mapper.createObjectNode();
    summary.put("order_id", body.path("id").asText());
    summary.put("status", body.path("status").asText());
    String captureId = CaptureIdExtractor.firstCaptureId(body);
    if (captureId != null) {
      summary.put("capture_id", captureId);
    }
    return ResponseEntity.ok(summary);
  }
}
```

Adjust the regex if your order IDs use additional characters.

## Idempotency

Repeated capture attempts for the same approved order may return `422` or a domain error if already captured. Treat **idempotent success** by checking order status or handling PayPal error codes (see `error-handling.md`).

## Related

- Refunds use `capture_id`: `refund-payment.md`
- Order details: `get-order-details.md`
