# Authorization flow — PayPal Standard Checkout (Spring Boot / Java)

For **`intent: AUTHORIZE`**, you **authorize** funds after buyer approval, then **capture** the authorization (full or partial), **void** unused authorization, or **reauthorize** before expiry.

**PayPal base (same as other snippets):**

- **Sandbox:** `https://api-m.sandbox.paypal.com`
- **Production:** `https://api-m.paypal.com`

## 1. Create order with `AUTHORIZE`

`POST /v2/checkout/orders` with:

```json
{
  "intent": "AUTHORIZE",
  "purchase_units": [
    {
      "amount": {
        "currency_code": "USD",
        "value": "50.00"
      }
    }
  ]
}
```

Use your existing `create-order` endpoint; validate `intent` is `AUTHORIZE` when routing to auth-specific UI.

## 2. Authorize payment (after buyer approves)

**PayPal:** `POST /v2/checkout/orders/{order_id}/authorize`

```java
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;

public class PayPalAuthorizeFlowClient {

  private final HttpClient http = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(10)).build();
  private final ObjectMapper mapper = new ObjectMapper();
  private final String baseUrl;
  private final PayPalTokenProvider tokens;

  public PayPalAuthorizeFlowClient(String baseUrl, PayPalTokenProvider tokens) {
    this.baseUrl = baseUrl.endsWith("/") ? baseUrl.substring(0, baseUrl.length() - 1) : baseUrl;
    this.tokens = tokens;
  }

  /** POST /v2/checkout/orders/{id}/authorize */
  public JsonNode authorizeOrder(String orderId) throws Exception {
    return postJson("/v2/checkout/orders/" + orderId + "/authorize", "{}");
  }

  /** POST /v2/payments/authorizations/{authorization_id}/capture */
  public JsonNode captureAuthorization(String authorizationId, String bodyJson) throws Exception {
    return postJson("/v2/payments/authorizations/" + authorizationId + "/capture", bodyJson);
  }

  /** POST /v2/payments/authorizations/{authorization_id}/void */
  public JsonNode voidAuthorization(String authorizationId) throws Exception {
    return postJson("/v2/payments/authorizations/" + authorizationId + "/void", "{}");
  }

  /** POST /v2/payments/authorizations/{authorization_id}/reauthorize */
  public JsonNode reauthorize(String authorizationId, String bodyJson) throws Exception {
    return postJson("/v2/payments/authorizations/" + authorizationId + "/reauthorize", bodyJson);
  }

  private JsonNode postJson(String path, String json) throws Exception {
    HttpRequest request = HttpRequest.newBuilder()
        .uri(URI.create(baseUrl + path))
        .timeout(Duration.ofSeconds(30))
        .header("Authorization", "Bearer " + tokens.getAccessToken())
        .header("Content-Type", "application/json")
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

## Extract authorization ID

From authorize response: `purchase_units[0].payments.authorizations[0].id`.

```java
import com.fasterxml.jackson.databind.JsonNode;

public final class AuthorizationIdExtractor {
  private AuthorizationIdExtractor() {}

  public static String firstAuthorizationId(JsonNode orderResponse) {
    JsonNode auths = orderResponse.path("purchase_units").path(0).path("payments").path("authorizations");
    if (!auths.isArray() || auths.isEmpty()) return null;
    return auths.get(0).path("id").asText(null);
  }
}
```

## Spring Boot routes (examples)

Map these to your API prefix (e.g. `/paypal-api/checkout/...`).

```java
import com.fasterxml.jackson.databind.JsonNode;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/paypal-api/checkout/orders")
public class PayPalAuthorizeController {

  private final PayPalAuthorizeFlowClient client;

  public PayPalAuthorizeController(PayPalAuthorizeFlowClient client) {
    this.client = client;
  }

  @PostMapping("/{orderId}/authorize")
  public ResponseEntity<JsonNode> authorize(@PathVariable String orderId) throws Exception {
    return ResponseEntity.ok(client.authorizeOrder(orderId));
  }
}
```

```java
import com.fasterxml.jackson.databind.JsonNode;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/paypal-api/payments/authorizations")
public class PayPalAuthorizationActionsController {

  private final PayPalAuthorizeFlowClient client;

  public PayPalAuthorizationActionsController(PayPalAuthorizeFlowClient client) {
    this.client = client;
  }

  @PostMapping("/{authorizationId}/capture")
  public ResponseEntity<JsonNode> capture(
      @PathVariable String authorizationId,
      @RequestBody(required = false) JsonNode body) throws Exception {
    String json = body == null || body.isNull() ? "{}" : body.toString();
    return ResponseEntity.ok(client.captureAuthorization(authorizationId, json));
  }

  @PostMapping("/{authorizationId}/void")
  public ResponseEntity<JsonNode> voidAuth(@PathVariable String authorizationId) throws Exception {
    return ResponseEntity.ok(client.voidAuthorization(authorizationId));
  }

  @PostMapping("/{authorizationId}/reauthorize")
  public ResponseEntity<JsonNode> reauthorize(
      @PathVariable String authorizationId,
      @RequestBody JsonNode body) throws Exception {
    return ResponseEntity.ok(client.reauthorize(authorizationId, body.toString()));
  }
}
```

## Flow summary

| Step | PayPal endpoint |
|------|------------------|
| Create order | `POST /v2/checkout/orders` (`intent: AUTHORIZE`) |
| Authorize | `POST /v2/checkout/orders/{id}/authorize` |
| Capture auth | `POST /v2/payments/authorizations/{auth_id}/capture` |
| Void | `POST /v2/payments/authorizations/{auth_id}/void` |
| Reauthorize | `POST /v2/payments/authorizations/{auth_id}/reauthorize` |

Capture response includes **capture `id`** for refunds (`refund-payment.md`).
