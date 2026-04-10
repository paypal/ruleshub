# Create order — PayPal Expanded Checkout (Spring Boot / `HttpClient`)

**PayPal API:** `POST /v2/checkout/orders`

- **Sandbox:** `https://api-m.sandbox.paypal.com/v2/checkout/orders`
- **Production:** `https://api-m.paypal.com/v2/checkout/orders`

For **card** payments, put context under **`payment_source.card`**, including **`experience_context`** (return/cancel URLs for 3DS) and **`attributes.verification.method`** (e.g. **`SCA_WHEN_REQUIRED`**). Do **not** use top-level `application_context` — use **`payment_source.paypal.experience_context`** for PayPal wallet flows instead.

## Request body shape (card)

```json
{
  "intent": "CAPTURE",
  "purchase_units": [
    {
      "amount": {
        "currency_code": "USD",
        "value": "50.00"
      }
    }
  ],
  "payment_source": {
    "card": {
      "experience_context": {
        "return_url": "https://yoursite.com/paypal/return",
        "cancel_url": "https://yoursite.com/paypal/cancel"
      },
      "attributes": {
        "verification": {
          "method": "SCA_WHEN_REQUIRED"
        }
      }
    }
  }
}
```

## Incoming request DTO (client → your API)

Your browser sends **amount/currency** (and optional metadata). The server **adds** `payment_source.card` — do not trust raw `payment_source` from the client.

```java
import com.fasterxml.jackson.annotation.JsonProperty;

import java.util.List;

public class CreateCheckoutOrderRequest {

  private String intent = "CAPTURE";
  @JsonProperty("purchase_units")
  private List<PurchaseUnit> purchaseUnits;

  public String getIntent() { return intent; }
  public void setIntent(String intent) { this.intent = intent; }
  public List<PurchaseUnit> getPurchaseUnits() { return purchaseUnits; }
  public void setPurchaseUnits(List<PurchaseUnit> purchaseUnits) { this.purchaseUnits = purchaseUnits; }

  public static class PurchaseUnit {
    private Amount amount;
    public Amount getAmount() { return amount; }
    public void setAmount(Amount amount) { this.amount = amount; }
  }

  public static class Amount {
    @JsonProperty("currency_code") private String currencyCode;
    private String value;
    public String getCurrencyCode() { return currencyCode; }
    public void setCurrencyCode(String currencyCode) { this.currencyCode = currencyCode; }
    public String getValue() { return value; }
    public void setValue(String value) { this.value = value; }
  }
}
```

## HttpClient — create order

```java
import com.fasterxml.jackson.databind.ObjectMapper;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.Map;
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

  public String createOrder(Object body) throws Exception {
    String json = mapper.writeValueAsString(body);
    HttpRequest request = HttpRequest.newBuilder()
        .uri(URI.create(baseUrl + "/v2/checkout/orders"))
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
    return mapper.readTree(response.body()).get("id").asText();
  }
}
```

## Spring Boot controller

```java
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/paypal")
public class ExpandedCheckoutOrderController {

  private final PayPalOrdersClient ordersClient;
  @Value("${app.paypal.return-url}")
  private String returnUrl;
  @Value("${app.paypal.cancel-url}")
  private String cancelUrl;

  public ExpandedCheckoutOrderController(PayPalOrdersClient ordersClient) {
    this.ordersClient = ordersClient;
  }

  @PostMapping("/orders")
  public ResponseEntity<Map<String, String>> create(@RequestBody CreateCheckoutOrderRequest req)
      throws Exception {
    if (req.getPurchaseUnits() == null || req.getPurchaseUnits().isEmpty()) {
      throw new IllegalArgumentException("purchase_units required");
    }

    var cardCtx = Map.of(
        "return_url", returnUrl,
        "cancel_url", cancelUrl
    );
    var verification = Map.of("method", "SCA_WHEN_REQUIRED");
    var attributes = Map.of("verification", verification);

    var paymentSource = Map.of(
        "card", Map.of(
            "experience_context", cardCtx,
            "attributes", attributes
        )
    );

    var body = Map.of(
        "intent", req.getIntent() != null ? req.getIntent() : "CAPTURE",
        "purchase_units", List.copyOf(req.getPurchaseUnits()),
        "payment_source", paymentSource
    );

    String id = ordersClient.createOrder(body);
    return ResponseEntity.ok(Map.of("id", id));
  }
}
```

Wire `PayPalOrdersClient` with base URL `https://api-m.sandbox.paypal.com` or `https://api-m.paypal.com` per environment.

## Summary

- Card Expanded Checkout → **`payment_source.card`** + **`experience_context`** + **`attributes.verification.method: SCA_WHEN_REQUIRED`** (or `SCA_ALWAYS` if required by your policy).
- PayPal wallet → **`payment_source.paypal.experience_context`** (never `application_context` at order root).
