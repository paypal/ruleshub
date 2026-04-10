# Webhooks — `gateway.webhookNotification().parse()`, PayPal `verify-webhook-signature`

Verify signatures **before** acting on payloads. Respond **200** quickly and process asynchronously for heavy work.

## Braintree — `gateway.webhookNotification().parse()`

Configure the webhook URL and credentials in the **Braintree Control Panel**. Braintree sends **`BT-SIGNATURE`** with the payload.

```java
import com.braintreegateway.BraintreeGateway;
import com.braintreegateway.WebhookNotification;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class BraintreeWebhookController {

  private final BraintreeGateway gateway;

  public BraintreeWebhookController(BraintreeGateway gateway) {
    this.gateway = gateway;
  }

  @PostMapping(value = "/webhooks/braintree", consumes = "application/json")
  public ResponseEntity<Void> braintree(
      @RequestHeader("BT-SIGNATURE") String btSignature, @RequestBody String payload) {

    WebhookNotification notification;
    try {
      notification = gateway.webhookNotification().parse(btSignature, payload);
    } catch (Exception e) {
      return ResponseEntity.badRequest().build();
    }

    String kind = notification.getKind().name();
    switch (kind) {
      case "TRANSACTION_SETTLED":
        // notification.getSubject().getTransaction()
        break;
      case "TRANSACTION_SETTLEMENT_DECLINED":
        break;
      case "DISPUTE_OPENED":
        break;
      case "DISPUTE_LOST":
      case "DISPUTE_WON":
        break;
      case "SUBSCRIPTION_CHARGED_SUCCESSFULLY":
      case "SUBSCRIPTION_CHARGED_UNSUCCESSFULLY":
        break;
      default:
        break;
    }

    return ResponseEntity.ok().build();
  }
}
```

### Common `kind` values (examples)

- **`TRANSACTION_SETTLED`**, **`TRANSACTION_SETTLEMENT_DECLINED`**
- **`DISPUTE_OPENED`**, **`DISPUTE_LOST`**, **`DISPUTE_WON`**
- Subscription lifecycle events if you use Braintree subscriptions

Use **`gateway.webhookNotification().parse(btSignature, payload)`** so invalid signatures fail closed (same behavior as **`WebhookNotification.parse`** with your gateway credentials).

## PayPal — `POST /v1/notifications/verify-webhook-signature`

```java
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class PayPalWebhookController {

  private static final ObjectMapper MAPPER = new ObjectMapper();

  private final HttpClient http = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(30)).build();
  private final String baseUrl;
  private final PayPalOAuthClient oauth;
  private final String webhookId;

  public PayPalWebhookController(
      @Value("${paypal.environment:sandbox}") String env,
      PayPalOAuthClient oauth,
      @Value("${paypal.webhook-id}") String webhookId) {
    this.baseUrl =
        "production".equalsIgnoreCase(env) ? "https://api-m.paypal.com" : "https://api-m.sandbox.paypal.com";
    this.oauth = oauth;
    this.webhookId = webhookId;
  }

  @PostMapping(value = "/webhooks/paypal", consumes = "application/json")
  public ResponseEntity<Void> paypal(
      @RequestHeader("PAYPAL-AUTH-ALGO") String authAlgo,
      @RequestHeader("PAYPAL-CERT-URL") String certUrl,
      @RequestHeader("PAYPAL-TRANSMISSION-ID") String transmissionId,
      @RequestHeader("PAYPAL-TRANSMISSION-SIG") String transmissionSig,
      @RequestHeader("PAYPAL-TRANSMISSION-TIME") String transmissionTime,
      @RequestBody JsonNode webhookEvent)
      throws Exception {

    ObjectNode verification = MAPPER.createObjectNode();
    verification.put("auth_algo", authAlgo);
    verification.put("cert_url", certUrl);
    verification.put("transmission_id", transmissionId);
    verification.put("transmission_sig", transmissionSig);
    verification.put("transmission_time", transmissionTime);
    verification.put("webhook_id", webhookId);
    verification.set("webhook_event", webhookEvent);

    String accessToken = oauth.getAccessToken();

    HttpRequest request =
        HttpRequest.newBuilder()
            .uri(URI.create(baseUrl + "/v1/notifications/verify-webhook-signature"))
            .timeout(Duration.ofSeconds(30))
            .header("Authorization", "Bearer " + accessToken)
            .header("Content-Type", "application/json")
            .POST(HttpRequest.BodyPublishers.ofString(MAPPER.writeValueAsString(verification)))
            .build();

    HttpResponse<String> response =
        http.send(request, HttpResponse.BodyHandlers.ofString());

    if (response.statusCode() / 100 != 2) {
      return ResponseEntity.internalServerError().build();
    }

    JsonNode body = MAPPER.readTree(response.body());
    if (!"SUCCESS".equals(body.path("verification_status").asText())) {
      return ResponseEntity.badRequest().build();
    }

    String eventType = webhookEvent.path("event_type").asText();
    switch (eventType) {
      case "PAYMENT.CAPTURE.COMPLETED":
        break;
      case "PAYMENT.CAPTURE.DENIED":
      case "PAYMENT.CAPTURE.REFUNDED":
        break;
      case "MERCHANT.ONBOARDING.COMPLETED":
        break;
      case "CUSTOMER.MERCHANT-INTEGRATION.SELLER-ONBOARDING.STARTED":
      case "CUSTOMER.MERCHANT-INTEGRATION.SELLER-ONBOARDING.COMPLETED":
        break;
      default:
        break;
    }

    return ResponseEntity.ok().build();
  }
}
```

`PayPalOAuthClient` is the **`HttpClient`** OAuth helper from `seller-onboarding.md`.

### Common `event_type` values (examples)

- **`PAYMENT.CAPTURE.COMPLETED`**, **`PAYMENT.CAPTURE.DENIED`**, **`PAYMENT.CAPTURE.REFUNDED`**
- **`MERCHANT.ONBOARDING.COMPLETED`**
- Seller onboarding variants under **`CUSTOMER.MERCHANT-INTEGRATION.*`**

Store **`paypal.webhook-id`** from the developer dashboard for verification. Log **`paypal-debug-id`** on failures.
