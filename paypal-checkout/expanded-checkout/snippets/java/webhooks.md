# Webhooks — PayPal Expanded Checkout (Spring Boot / `HttpClient`)

Subscribe to payment and vault events for **card** flows. Verify every inbound **`POST`** with **`POST /v1/notifications/verify-webhook-signature`** before side effects.

**Verification URL:**

- **Sandbox:** `https://api-m.sandbox.paypal.com/v1/notifications/verify-webhook-signature`
- **Production:** `https://api-m.paypal.com/v1/notifications/verify-webhook-signature`

## Expanded-oriented events

| Event | Use |
|-------|-----|
| `PAYMENT.CAPTURE.COMPLETED` | Fulfillment — card capture succeeded |
| `PAYMENT.CAPTURE.DENIED` | Notify buyer, stop fulfillment |
| `PAYMENT.CAPTURE.PENDING` | Wait before shipping |
| `PAYMENT.CAPTURE.REFUNDED` | Reverse fulfillment / accounting |
| `VAULT.PAYMENT-TOKEN.CREATED` | Persist vaulted card token (server-side) |
| `VAULT.PAYMENT-TOKEN.DELETED` | Remove stored token |
| `PAYMENT.AUTHORIZATION.*` | If you use `AUTHORIZE` intent |

Card-related resource paths often include **`resource.payment_source.card`** fields (e.g. last digits) — confirm against each event’s sample payload in the dashboard.

## Verification client (`HttpClient`)

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
public class PayPalExpandedWebhookController {

  private final PayPalWebhookVerifier verifier;
  private final ObjectMapper mapper = new ObjectMapper();

  public PayPalExpandedWebhookController(
      @Value("${paypal.environment}") String env,
      @Value("${paypal.webhook-id}") String webhookId,
      PayPalTokenProvider tokens) {
    String base = "production".equalsIgnoreCase(env)
        ? "https://api-m.paypal.com"
        : "https://api-m.sandbox.paypal.com";
    this.verifier = new PayPalWebhookVerifier(base, tokens, webhookId);
  }

  @PostMapping("/api/paypal/webhooks")
  public ResponseEntity<Void> handle(HttpServletRequest request) throws Exception {
    String raw = StreamUtils.copyToString(request.getInputStream(), StandardCharsets.UTF_8);
    JsonNode webhookEvent = mapper.readTree(raw);

    boolean ok = verifier.verify(
        request.getHeader("PAYPAL-TRANSMISSION-ID"),
        request.getHeader("PAYPAL-TRANSMISSION-TIME"),
        request.getHeader("PAYPAL-CERT-URL"),
        request.getHeader("PAYPAL-AUTH-ALGO"),
        request.getHeader("PAYPAL-TRANSMISSION-SIG"),
        webhookEvent);

    if (!ok) {
      return ResponseEntity.status(HttpStatus.FORBIDDEN).build();
    }

    String eventType = webhookEvent.path("event_type").asText();
    String eventId = webhookEvent.path("id").asText();
    processExpandedEvent(eventType, eventId, webhookEvent);

    return ResponseEntity.ok().build();
  }

  private void processExpandedEvent(String eventType, String eventId, JsonNode webhookEvent) {
    switch (eventType) {
      case "PAYMENT.CAPTURE.COMPLETED" -> { /* fulfill */ }
      case "VAULT.PAYMENT-TOKEN.CREATED" -> {
        JsonNode resource = webhookEvent.path("resource");
        String tokenId = resource.path("id").asText(null);
        JsonNode card = resource.path("payment_source").path("card");
        String lastDigits = card.path("last_digits").asText(null);
        // persist tokenId + lastDigits for UX; store server-side only
      }
      default -> { /* log or ignore */ }
    }
  }
}
```

## Production checklist

- Return **200** quickly; queue heavy work.
- **Deduplicate** by `event.id`.
- Use matching **webhook ID** and credentials for sandbox vs production.
