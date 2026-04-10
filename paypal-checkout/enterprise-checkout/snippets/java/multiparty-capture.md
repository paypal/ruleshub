# Multiparty capture and refunds — `HttpClient`, Auth-Assertion, platform fee refund

**Capture** the approved order with **`POST /v2/checkout/orders/{order_id}/capture`** and the same **`PayPal-Auth-Assertion`** pattern used at create time. **Refunds** can include **`payment_instruction.platform_fees`** to refund part of the platform fee.

REST bases: Sandbox **`https://api-m.sandbox.paypal.com`**, Production **`https://api-m.paypal.com`**.

## Capture order

```java
import java.net.URI;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;

public class MultipartyCaptureClient {

  private final HttpClient http = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(30)).build();
  private final String baseUrl;

  public MultipartyCaptureClient(String paypalEnvironment) {
    this.baseUrl =
        "production".equalsIgnoreCase(paypalEnvironment)
            ? "https://api-m.paypal.com"
            : "https://api-m.sandbox.paypal.com";
  }

  public String captureOrder(String accessToken, String orderId, String authAssertionJwt)
      throws Exception {

    String encoded = URLEncoder.encode(orderId, StandardCharsets.UTF_8);

    HttpRequest request =
        HttpRequest.newBuilder()
            .uri(URI.create(baseUrl + "/v2/checkout/orders/" + encoded + "/capture"))
            .timeout(Duration.ofSeconds(30))
            .header("Authorization", "Bearer " + accessToken)
            .header("Content-Type", "application/json")
            .header("PayPal-Auth-Assertion", authAssertionJwt)
            .POST(HttpRequest.BodyPublishers.ofString("{}"))
            .build();

    HttpResponse<String> response =
        http.send(request, HttpResponse.BodyHandlers.ofString());

    if (response.statusCode() / 100 != 2) {
      throw new IllegalStateException("capture failed: " + response.body());
    }

    return response.body();
  }
}
```

### Fee split (response)

Parse **`purchase_units[0].payments.captures[0].seller_receivable_breakdown`** (and related fields) per Orders API v2 schema for reconciliation.

## Refund capture with platform fee component

```java
import com.fasterxml.jackson.databind.ObjectMapper;

  public String refundCaptureWithPlatformFee(
      String accessToken,
      String captureId,
      String totalRefundAmount,
      String platformFeeRefundAmount,
      String currencyCode,
      String authAssertionJwt)
      throws Exception {

    ObjectMapper mapper = new ObjectMapper();
    var body =
        mapper.createObjectNode()
            .set(
                "amount",
                mapper.createObjectNode()
                    .put("currency_code", currencyCode)
                    .put("value", totalRefundAmount))
            .set(
                "payment_instruction",
                mapper
                    .createObjectNode()
                    .set(
                        "platform_fees",
                        mapper
                            .createArrayNode()
                            .add(
                                mapper
                                    .createObjectNode()
                                    .set(
                                        "amount",
                                        mapper
                                            .createObjectNode()
                                            .put("currency_code", currencyCode)
                                            .put("value", platformFeeRefundAmount)))));

    String encoded = URLEncoder.encode(captureId, StandardCharsets.UTF_8);

    HttpRequest request =
        HttpRequest.newBuilder()
            .uri(URI.create(baseUrl + "/v2/payments/captures/" + encoded + "/refund"))
            .timeout(Duration.ofSeconds(30))
            .header("Authorization", "Bearer " + accessToken)
            .header("Content-Type", "application/json")
            .header("PayPal-Auth-Assertion", authAssertionJwt)
            .POST(HttpRequest.BodyPublishers.ofString(mapper.writeValueAsString(body)))
            .build();

    HttpResponse<String> response =
        http.send(request, HttpResponse.BodyHandlers.ofString());

    if (response.statusCode() / 100 != 2) {
      throw new IllegalStateException("refund failed: " + response.body());
    }

    return response.body();
  }
```

Align **`platform_fees`** amounts with PayPal multiparty refund rules (currency match, eligible captures). Consult the current API reference for optional fields (invoice id, note to payer).
