# Create order — PayPal Standard Checkout (Spring Boot / Java)

**App endpoint:** `POST /paypal-api/checkout/orders/create`  
**PayPal API:** `POST /v2/checkout/orders`

- **Sandbox:** `https://api-m.sandbox.paypal.com/v2/checkout/orders`
- **Production:** `https://api-m.paypal.com/v2/checkout/orders`

Use **Bearer** access token from OAuth (`client_credentials`). Send JSON body per [Orders v2](https://developer.paypal.com/docs/api/orders/v2/).

## DTOs (Jackson)

```java
import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.annotation.JsonProperty;

import java.util.List;
import java.util.Map;

@JsonInclude(JsonInclude.Include.NON_NULL)
public class CreateOrderRequest {

  private String intent;
  @JsonProperty("purchase_units")
  private List<PurchaseUnit> purchaseUnits;
  @JsonProperty("payment_source")
  private Map<String, Object> paymentSource;

  public String getIntent() { return intent; }
  public void setIntent(String intent) { this.intent = intent; }
  public List<PurchaseUnit> getPurchaseUnits() { return purchaseUnits; }
  public void setPurchaseUnits(List<PurchaseUnit> purchaseUnits) { this.purchaseUnits = purchaseUnits; }
  public Map<String, Object> getPaymentSource() { return paymentSource; }
  public void setPaymentSource(Map<String, Object> paymentSource) { this.paymentSource = paymentSource; }

  @JsonInclude(JsonInclude.Include.NON_NULL)
  public static class PurchaseUnit {
    private Amount amount;
    private String description;
    @JsonProperty("custom_id")
    private String customId;

    public Amount getAmount() { return amount; }
    public void setAmount(Amount amount) { this.amount = amount; }
    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }
    public String getCustomId() { return customId; }
    public void setCustomId(String customId) { this.customId = customId; }
  }

  @JsonInclude(JsonInclude.Include.NON_NULL)
  public static class Amount {
    @JsonProperty("currency_code")
    private String currencyCode;
    private String value;

    public String getCurrencyCode() { return currencyCode; }
    public void setCurrencyCode(String currencyCode) { this.currencyCode = currencyCode; }
    public String getValue() { return value; }
    public void setValue(String value) { this.value = value; }
  }
}
```

## Validation

```java
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;

import java.math.BigDecimal;
import java.util.regex.Pattern;

@Component
public class CreateOrderValidator {

  private static final Pattern TWO_DECIMALS = Pattern.compile("^\\d+\\.\\d{2}$");

  public void validate(CreateOrderRequest req) {
    if (req == null) throw new IllegalArgumentException("body required");
    if (!StringUtils.hasText(req.getIntent())
        || (!"CAPTURE".equals(req.getIntent()) && !"AUTHORIZE".equals(req.getIntent()))) {
      throw new IllegalArgumentException("intent must be CAPTURE or AUTHORIZE");
    }
    if (req.getPurchaseUnits() == null || req.getPurchaseUnits().isEmpty()) {
      throw new IllegalArgumentException("purchase_units required");
    }
    var pu = req.getPurchaseUnits().get(0);
    if (pu.getAmount() == null
        || !StringUtils.hasText(pu.getAmount().getCurrencyCode())
        || !StringUtils.hasText(pu.getAmount().getValue())) {
      throw new IllegalArgumentException("purchase_units[0].amount required");
    }
    String v = pu.getAmount().getValue().trim();
    if (!TWO_DECIMALS.matcher(v).matches()) {
      throw new IllegalArgumentException("amount value must have 2 decimal places");
    }
    if (new BigDecimal(v).compareTo(BigDecimal.ZERO) <= 0) {
      throw new IllegalArgumentException("amount must be > 0");
    }
  }
}
```

## PayPal client (HttpClient)

```java
import com.fasterxml.jackson.databind.ObjectMapper;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.UUID;

public class PayPalOrdersClient {

  private final HttpClient http = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(10)).build();
  private final ObjectMapper mapper = new ObjectMapper();
  private final String baseUrl;
  private final PayPalTokenProvider tokens;

  public PayPalOrdersClient(String baseUrl, PayPalTokenProvider tokens) {
    this.baseUrl = baseUrl.endsWith("/") ? baseUrl.substring(0, baseUrl.length() - 1) : baseUrl;
    this.tokens = tokens;
  }

  public String createOrder(CreateOrderRequest body) throws Exception {
    String json = mapper.writeValueAsString(body);
    String idempotency = UUID.randomUUID().toString();

    HttpRequest request = HttpRequest.newBuilder()
        .uri(URI.create(baseUrl + "/v2/checkout/orders"))
        .timeout(Duration.ofSeconds(30))
        .header("Authorization", "Bearer " + tokens.getAccessToken())
        .header("Content-Type", "application/json")
        .header("PayPal-Request-Id", idempotency)
        .POST(HttpRequest.BodyPublishers.ofString(json, StandardCharsets.UTF_8))
        .build();

    HttpResponse<String> response =
        http.send(request, HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8));

    if (response.statusCode() < 200 || response.statusCode() >= 300) {
      throw new PayPalApiException(response.statusCode(), response.body(), response.headers());
    }
    var root = mapper.readTree(response.body());
    return root.get("id").asText();
  }
}
```

`PayPalTokenProvider` is any component that returns a cached OAuth `access_token`. `PayPalApiException` can carry status, body, and `PayPal-Debug-Id` (see `error-handling.md`).

## Spring Boot controller

```java
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

@RestController
@RequestMapping("/paypal-api/checkout/orders")
public class PayPalCheckoutOrdersController {

  private final CreateOrderValidator validator;
  private final PayPalOrdersClient ordersClient;

  public PayPalCheckoutOrdersController(CreateOrderValidator validator, PayPalOrdersClient ordersClient) {
    this.validator = validator;
    this.ordersClient = ordersClient;
  }

  @PostMapping("/create")
  public ResponseEntity<Map<String, String>> create(@RequestBody CreateOrderRequest body) throws Exception {
    validator.validate(body);
    String orderId = ordersClient.createOrder(body);
    return ResponseEntity.ok(Map.of("id", orderId));
  }
}
```

Return the full order JSON if your client needs `links` or status; the minimal response above matches common JS `createOrder` handlers that only need `id`.

## Configuration wiring

```java
@Bean
public PayPalOrdersClient payPalOrdersClient(
    @Value("${paypal.mode}") String mode,
    PayPalTokenProvider tokenProvider) {
  String base = "live".equalsIgnoreCase(mode)
      ? "https://api-m.paypal.com"
      : "https://api-m.sandbox.paypal.com";
  return new PayPalOrdersClient(base, tokenProvider);
}
```

## Summary

- Validate `intent`, `purchase_units`, amounts, and currency before calling PayPal.
- Use **Jackson** for serialization; set `PayPal-Request-Id` for safe retries.
- Map 4xx/5xx to your API errors and log `PayPal-Debug-Id` from response headers.
