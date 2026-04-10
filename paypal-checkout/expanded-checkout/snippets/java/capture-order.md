# Capture order — PayPal Expanded Checkout (Spring Boot / `HttpClient`)

**PayPal API:** `POST /v2/checkout/orders/{order_id}/capture`

- **Sandbox:** `https://api-m.sandbox.paypal.com/v2/checkout/orders/{order_id}/capture`
- **Production:** `https://api-m.paypal.com/v2/checkout/orders/{order_id}/capture`

After the buyer approves (and 3DS completes when required), capture on your server. Inspect **`payment_source.card`** in the response for **brand**, **last digits**, **liability shift**, and **authentication_result**.

## HttpClient — capture

```java
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.Optional;
import java.util.UUID;

public class PayPalOrdersClient {

  private final HttpClient http = HttpClient.newBuilder()
      .connectTimeout(Duration.ofSeconds(10))
      .build();
  private final ObjectMapper mapper = new ObjectMapper();
  private final String baseUrl;
  private final PayPalTokenProvider tokens;

  public PayPalOrdersClient(String baseUrl, PayPalTokenProvider tokens) {
    this.baseUrl = baseUrl.endsWith("/") ? baseUrl.substring(0, baseUrl.length() - 1) : baseUrl;
    this.tokens = tokens;
  }

  /**
   * Full capture with empty body. Returns parsed JSON for card-specific fields.
   */
  public JsonNode captureOrder(String orderId) throws Exception {
    HttpRequest request = HttpRequest.newBuilder()
        .uri(URI.create(baseUrl + "/v2/checkout/orders/" + orderId + "/capture"))
        .timeout(Duration.ofSeconds(45))
        .header("Authorization", "Bearer " + tokens.getAccessToken())
        .header("Content-Type", "application/json")
        .header("PayPal-Request-Id", UUID.randomUUID().toString())
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

## Card-specific response fields (typical paths)

Parse the capture JSON (structure follows [Orders v2](https://developer.paypal.com/docs/api/orders/v2/)):

| Concept | JSON path (illustrative) |
|--------|---------------------------|
| Card brand | `payment_source.card.brand` |
| Last digits | `payment_source.card.last_digits` |
| Expiry | `payment_source.card.expiry` |
| 3DS / auth | `payment_source.card.authentication_result` |
| Liability | `payment_source.card.attributes.liability_shift` (when present) |

```java
public class CardCaptureDetails {

  public static Optional<String> cardBrand(JsonNode capture) {
    return Optional.ofNullable(capture.path("payment_source").path("card").path("brand").asText(null));
  }

  public static Optional<String> liabilityShift(JsonNode capture) {
    return Optional.ofNullable(
        capture.path("payment_source").path("card").path("attributes").path("liability_shift").asText(null));
  }

  public static JsonNode authenticationResult(JsonNode capture) {
    return capture.path("payment_source").path("card").path("authentication_result");
  }
}
```

## Spring Boot controller

```java
import com.fasterxml.jackson.databind.JsonNode;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/paypal/orders")
public class CaptureOrderController {

  private final PayPalOrdersClient ordersClient;

  public CaptureOrderController(PayPalOrdersClient ordersClient) {
    this.ordersClient = ordersClient;
  }

  @PostMapping("/{orderId}/capture")
  public ResponseEntity<JsonNode> capture(@PathVariable String orderId) throws Exception {
    JsonNode body = ordersClient.captureOrder(orderId);
    return ResponseEntity.ok(body);
  }
}
```

Return only the fields your frontend needs, or a DTO mapped from `JsonNode`.

## Business use of liability / 3DS

- Use **`authentication_result`** (and liability fields when present) for risk and support workflows (`3ds-integration.md`).
- Do not treat capture success alone as proof of a specific liability shift without reading PayPal’s field definitions for your region.
