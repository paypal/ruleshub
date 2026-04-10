# Refund payment — PayPal Standard Checkout (Spring Boot / Java)

**App endpoint (example):** `POST /paypal-api/payments/captures/{captureId}/refund`  
**PayPal API:** `POST /v2/payments/captures/{capture_id}/refund`

- **Sandbox:** `https://api-m.sandbox.paypal.com/v2/payments/captures/{capture_id}/refund`
- **Production:** `https://api-m.paypal.com/v2/payments/captures/{capture_id}/refund`

Use the **capture ID** from the capture (or get-order) response, not the order ID.

## Full refund

Empty body `{}` refunds the full captured amount.

## Partial refund

```json
{
  "amount": {
    "value": "5.00",
    "currency_code": "USD"
  },
  "note_to_payer": "Partial refund for item return"
}
```

## DTO and client

```java
import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.annotation.JsonProperty;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.UUID;

@JsonInclude(JsonInclude.Include.NON_NULL)
public class RefundRequest {

  private Amount amount;
  @JsonProperty("note_to_payer")
  private String noteToPayer;

  public Amount getAmount() { return amount; }
  public void setAmount(Amount amount) { this.amount = amount; }
  public String getNoteToPayer() { return noteToPayer; }
  public void setNoteToPayer(String noteToPayer) { this.noteToPayer = noteToPayer; }

  @JsonInclude(JsonInclude.Include.NON_NULL)
  public static class Amount {
    private String value;
    @JsonProperty("currency_code")
    private String currencyCode;

    public String getValue() { return value; }
    public void setValue(String value) { this.value = value; }
    public String getCurrencyCode() { return currencyCode; }
    public void setCurrencyCode(String currencyCode) { this.currencyCode = currencyCode; }
  }
}
```

```java
public class PayPalRefundClient {

  private final HttpClient http = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(10)).build();
  private final ObjectMapper mapper = new ObjectMapper();
  private final String baseUrl;
  private final PayPalTokenProvider tokens;

  public PayPalRefundClient(String baseUrl, PayPalTokenProvider tokens) {
    this.baseUrl = baseUrl.endsWith("/") ? baseUrl.substring(0, baseUrl.length() - 1) : baseUrl;
    this.tokens = tokens;
  }

  public JsonNode refundCapture(String captureId, RefundRequest refundOrNull) throws Exception {
    String json = refundOrNull == null ? "{}" : mapper.writeValueAsString(refundOrNull);
    HttpRequest request = HttpRequest.newBuilder()
        .uri(URI.create(baseUrl + "/v2/payments/captures/" + captureId + "/refund"))
        .timeout(Duration.ofSeconds(30))
        .header("Authorization", "Bearer " + tokens.getAccessToken())
        .header("Content-Type", "application/json")
        .header("PayPal-Request-Id", UUID.randomUUID().toString())
        .POST(HttpRequest.BodyPublishers.ofString(json, StandardCharsets.UTF_8))
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

## Spring Boot controller

```java
import com.fasterxml.jackson.databind.JsonNode;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/paypal-api/payments/captures")
public class PayPalRefundController {

  private final PayPalRefundClient refundClient;

  public PayPalRefundController(PayPalRefundClient refundClient) {
    this.refundClient = refundClient;
  }

  @PostMapping("/{captureId}/refund")
  public ResponseEntity<JsonNode> refund(
      @PathVariable String captureId,
      @RequestBody(required = false) RefundRequest body) throws Exception {
    if (captureId == null || captureId.isBlank()) {
      throw new IllegalArgumentException("captureId required");
    }
    JsonNode result = refundClient.refundCapture(captureId, body);
    return ResponseEntity.ok(result);
  }
}
```

## Response

The response includes refund `id`, `status`, and `amount`—store for support and reconciliation.

## Idempotency

Use **`PayPal-Request-Id`** with a stable key per logical refund operation to avoid duplicate refunds on retries.

## Related

- Obtain `capture_id`: `capture-order.md`, `get-order-details.md`
