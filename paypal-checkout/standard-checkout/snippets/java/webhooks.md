# Webhooks — PayPal Standard Checkout (Spring Boot / Java)

Subscribe to events in the **PayPal Developer Dashboard**. Your listener receives **POST** requests with a JSON body; verify signatures using PayPal’s **`POST /v1/notifications/verify-webhook-signature`** before trusting the payload.

**Verification endpoint:**

- **Sandbox:** `https://api-m.sandbox.paypal.com/v1/notifications/verify-webhook-signature`
- **Production:** `https://api-m.paypal.com/v1/notifications/verify-webhook-signature`

## Environment variables

| Variable | Purpose |
|----------|---------|
| `PAYPAL_CLIENT_ID` | REST app client ID |
| `PAYPAL_CLIENT_SECRET` | REST app secret |
| `PAYPAL_WEBHOOK_ID` | Webhook ID from the dashboard for this URL |

Use `@Value` or `System.getenv()` consistently with other snippets.

## Webhook DTO (incoming POST)

```java
import com.fasterxml.jackson.annotation.JsonProperty;
import com.fasterxml.jackson.databind.JsonNode;

import java.util.Map;

public class WebhookEventEnvelope {

  private String id;
  @JsonProperty("event_type")
  private String eventType;
  @JsonProperty("resource_type")
  private String resourceType;
  private JsonNode resource;
  private Map<String, Object> summary;

  public String getId() { return id; }
  public void setId(String id) { this.id = id; }
  public String getEventType() { return eventType; }
  public void setEventType(String eventType) { this.eventType = eventType; }
  public String getResourceType() { return resourceType; }
  public void setResourceType(String resourceType) { this.resourceType = resourceType; }
  public JsonNode getResource() { return resource; }
  public void setResource(JsonNode resource) { this.resource = resource; }
  public Map<String, Object> getSummary() { return summary; }
  public void setSummary(Map<String, Object> summary) { this.summary = summary; }
}
```

## Verification request body

PayPal expects (field names per API):

```json
{
  "auth_algo": "...",
  "cert_url": "...",
  "transmission_id": "...",
  "transmission_sig": "...",
  "transmission_time": "...",
  "webhook_id": "YOUR_WEBHOOK_ID",
  "webhook_event": { }
}
```

The **`webhook_event`** object should be the **full parsed JSON body** of the incoming POST.

## Verification client

```java
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;

public class PayPalWebhookVerifier {

  private final HttpClient http = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(10)).build();
  private final ObjectMapper mapper = new ObjectMapper();
  private final String baseUrl;
  private final PayPalTokenProvider tokens;
  private final String webhookId;

  public PayPalWebhookVerifier(String baseUrl, PayPalTokenProvider tokens, String webhookId) {
    this.baseUrl = baseUrl.endsWith("/") ? baseUrl.substring(0, baseUrl.length() - 1) : baseUrl;
    this.tokens = tokens;
    this.webhookId = webhookId;
  }

  public boolean verify(
      String transmissionId,
      String transmissionTime,
      String certUrl,
      String authAlgo,
      String transmissionSig,
      JsonNode webhookEvent) throws Exception {

    ObjectNode body = mapper.createObjectNode();
    body.put("transmission_id", transmissionId);
    body.put("transmission_time", transmissionTime);
    body.put("cert_url", certUrl);
    body.put("auth_algo", authAlgo);
    body.put("transmission_sig", transmissionSig);
    body.put("webhook_id", webhookId);
    body.set("webhook_event", webhookEvent);

    HttpRequest request = HttpRequest.newBuilder()
        .uri(URI.create(baseUrl + "/v1/notifications/verify-webhook-signature"))
        .timeout(Duration.ofSeconds(15))
        .header("Authorization", "Bearer " + tokens.getAccessToken())
        .header("Content-Type", "application/json")
        .POST(HttpRequest.BodyPublishers.ofString(mapper.writeValueAsString(body), StandardCharsets.UTF_8))
        .build();

    HttpResponse<String> response =
        http.send(request, HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8));

    if (response.statusCode() < 200 || response.statusCode() >= 300) {
      throw new PayPalApiException(response.statusCode(), response.body(), response.headers());
    }
    JsonNode root = mapper.readTree(response.body());
    return "SUCCESS".equalsIgnoreCase(root.path("verification_status").asText());
  }
}
```

## Spring Boot listener

Read **headers** and **raw body** for verification. Using `HttpServletRequest` + caching filter, or Spring’s `ContentCachingRequestWrapper`, ensures you can pass the exact JSON into `webhook_event`.

**Simplified example** (if your filter provides raw JSON as string):

```java
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;

import jakarta.servlet.http.HttpServletRequest;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.util.StreamUtils;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RestController;

import java.nio.charset.StandardCharsets;

@RestController
public class PayPalWebhookController {

  private final PayPalWebhookVerifier verifier;
  private final ObjectMapper mapper = new ObjectMapper();

  public PayPalWebhookController(
      @Value("${paypal.mode}") String mode,
      @Value("${paypal.webhook-id}") String webhookId,
      PayPalTokenProvider tokens) {
    String base = "live".equalsIgnoreCase(mode)
        ? "https://api-m.paypal.com"
        : "https://api-m.sandbox.paypal.com";
    this.verifier = new PayPalWebhookVerifier(base, tokens, webhookId);
  }

  @PostMapping("/paypal-api/webhooks/events")
  public ResponseEntity<Void> handle(HttpServletRequest request) throws Exception {
    String raw = StreamUtils.copyToString(request.getInputStream(), StandardCharsets.UTF_8);
    JsonNode webhookEvent = mapper.readTree(raw);

    String transmissionId = request.getHeader("PAYPAL-TRANSMISSION-ID");
    String transmissionTime = request.getHeader("PAYPAL-TRANSMISSION-TIME");
    String certUrl = request.getHeader("PAYPAL-CERT-URL");
    String authAlgo = request.getHeader("PAYPAL-AUTH-ALGO");
    String transmissionSig = request.getHeader("PAYPAL-TRANSMISSION-SIG");

    boolean ok = verifier.verify(transmissionId, transmissionTime, certUrl, authAlgo, transmissionSig, webhookEvent);
    if (!ok) {
      return ResponseEntity.status(HttpStatus.FORBIDDEN).build();
    }

    String eventType = webhookEvent.path("event_type").asText();
    // Idempotent processing: store event id (webhookEvent.path("id")) before side effects
    processEvent(eventType, webhookEvent);

    return ResponseEntity.ok().build();
  }

  private void processEvent(String eventType, JsonNode webhookEvent) {
    // e.g. PAYMENT.CAPTURE.COMPLETED — update order state, fulfillment, etc.
  }
}
```

**Production notes:**

- Return **200** quickly and process asynchronously for heavy work.
- **Deduplicate** using `event.id` (PayPal may retry).
- Align **Sandbox vs Live** `webhook_id` and app credentials with the environment that sends the event.

## `application.yml`

```yaml
paypal:
  webhook-id: ${PAYPAL_WEBHOOK_ID}
```

## Related

- Token provider: `error-handling.md` (`PayPalTokenProvider`)
- Order reconciliation: `get-order-details.md`
