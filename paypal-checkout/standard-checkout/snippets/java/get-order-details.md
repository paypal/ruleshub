# Get order details — PayPal Standard Checkout (Spring Boot / Java)

**App endpoint:** `GET /paypal-api/checkout/orders/{orderId}`  
**PayPal API:** `GET /v2/checkout/orders/{order_id}`

- **Sandbox:** `https://api-m.sandbox.paypal.com/v2/checkout/orders/{order_id}`
- **Production:** `https://api-m.paypal.com/v2/checkout/orders/{order_id}`

Use this to **verify** status before capture, show order details in your admin UI, or reconcile after webhooks.

## PayPal client (HttpClient)

```java
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;

public class PayPalGetOrderClient {

  private final HttpClient http = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(10)).build();
  private final ObjectMapper mapper = new ObjectMapper();
  private final String baseUrl;
  private final PayPalTokenProvider tokens;

  public PayPalGetOrderClient(String baseUrl, PayPalTokenProvider tokens) {
    this.baseUrl = baseUrl.endsWith("/") ? baseUrl.substring(0, baseUrl.length() - 1) : baseUrl;
    this.tokens = tokens;
  }

  public JsonNode getOrder(String orderId) throws Exception {
    HttpRequest request = HttpRequest.newBuilder()
        .uri(URI.create(baseUrl + "/v2/checkout/orders/" + orderId))
        .timeout(Duration.ofSeconds(20))
        .header("Authorization", "Bearer " + tokens.getAccessToken())
        .GET()
        .build();

    HttpResponse<String> response =
        http.send(request, HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8));

    if (response.statusCode() == 404) {
      return null;
    }
    if (response.statusCode() < 200 || response.statusCode() >= 300) {
      throw new PayPalApiException(response.statusCode(), response.body(), response.headers());
    }
    return mapper.readTree(response.body());
  }
}
```

## Spring Boot controller

```java
import com.fasterxml.jackson.databind.JsonNode;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/paypal-api/checkout/orders")
public class PayPalGetOrderController {

  private final PayPalGetOrderClient getOrderClient;

  public PayPalGetOrderController(PayPalGetOrderClient getOrderClient) {
    this.getOrderClient = getOrderClient;
  }

  @GetMapping("/{orderId}")
  public ResponseEntity<JsonNode> get(@PathVariable String orderId) throws Exception {
    if (orderId == null || orderId.isBlank()) {
      throw new IllegalArgumentException("orderId required");
    }
    JsonNode order = getOrderClient.getOrder(orderId);
    if (order == null) {
      return ResponseEntity.notFound().build();
    }
    return ResponseEntity.ok(order);
  }
}
```

## Typical fields

- `id` — order ID  
- `status` — `CREATED`, `SAVED`, `APPROVED`, `VOIDED`, `COMPLETED`, `PAYER_ACTION_REQUIRED`, etc.  
- `purchase_units[]` — amounts, shipping, `payments` (authorizations/captures)  
- `payer` — payer info when available  

## Related

- Capture: `capture-order.md`
- Authorization flow: `authorize-order.md`
