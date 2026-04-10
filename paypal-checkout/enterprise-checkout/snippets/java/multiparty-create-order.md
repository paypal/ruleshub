# Multiparty create order — `POST /v2/checkout/orders`, platform fees, Auth-Assertion, `experience_context`

Create a **PayPal** order where the **seller** is the payee and the **platform** takes a fee. Use **`payment_source.paypal.experience_context`** for locale, brand, shipping, return/cancel URLs, etc. **Do not** use deprecated top-level **`application_context`** for new integrations.

Use **`PayPal-Auth-Assertion`** (JWT) so PayPal knows the partner is acting for the seller.

REST bases: Sandbox **`https://api-m.sandbox.paypal.com`**, Production **`https://api-m.paypal.com`**.

## Build Auth-Assertion JWT (header value)

The assertion is a **signed JWT** whose claims include (at minimum) **`iss`** = partner REST **client_id** and **`payer_id`** = **seller merchant id**. Generate per PayPal multiparty docs (algorithm and key material from your partner app).

```text
PayPal-Auth-Assertion: eyJhbGciOi...<JWT>...
```

Inject the JWT string your signing utility returns into **`PayPal-Auth-Assertion`**.

## `POST /v2/checkout/orders` — `HttpClient`

```java
import com.fasterxml.jackson.databind.ObjectMapper;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;

public class MultipartyOrdersClient {

  private static final ObjectMapper MAPPER = new ObjectMapper();

  private final HttpClient http = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(30)).build();
  private final String baseUrl;

  public MultipartyOrdersClient(String paypalEnvironment) {
    this.baseUrl =
        "production".equalsIgnoreCase(paypalEnvironment)
            ? "https://api-m.paypal.com"
            : "https://api-m.sandbox.paypal.com";
  }

  /**
   * @param authAssertionJwt signed JWT per PayPal multiparty (iss=partner client_id, payer_id=seller_merchant_id)
   */
  public String createOrder(
      String accessToken,
      String sellerMerchantId,
      String platformFeeAmount,
      String itemTotal,
      String currencyCode,
      String authAssertionJwt)
      throws Exception {

    var root =
        MAPPER.createObjectNode()
            .put("intent", "CAPTURE")
            .set(
                "purchase_units",
                MAPPER.createArrayNode()
                    .add(
                        MAPPER.createObjectNode()
                            .put("reference_id", "default")
                            .set(
                                "amount",
                                MAPPER.createObjectNode()
                                    .put("currency_code", currencyCode)
                                    .put("value", itemTotal)
                                    .set(
                                        "breakdown",
                                        MAPPER.createObjectNode()
                                            .set(
                                                "item_total",
                                                MAPPER.createObjectNode()
                                                    .put("currency_code", currencyCode)
                                                    .put("value", itemTotal))))
                            .set(
                                "payee",
                                MAPPER.createObjectNode().put("merchant_id", sellerMerchantId))
                            .set(
                                "payment_instruction",
                                MAPPER.createObjectNode()
                                    .set(
                                        "platform_fees",
                                        MAPPER.createArrayNode()
                                            .add(
                                                MAPPER.createObjectNode()
                                                    .set(
                                                        "amount",
                                                        MAPPER.createObjectNode()
                                                            .put("currency_code", currencyCode)
                                                            .put("value", platformFeeAmount))))))
            .set(
                "payment_source",
                MAPPER.createObjectNode()
                    .set(
                        "paypal",
                        MAPPER.createObjectNode()
                            .set(
                                "experience_context",
                                MAPPER.createObjectNode()
                                    .put("payment_method_preference", "IMMEDIATE_PAYMENT_REQUIRED")
                                    .put("brand_name", "My Marketplace")
                                    .put("locale", "en-US")
                                    .put("landing_page", "LOGIN")
                                    .put("user_action", "PAY_NOW")
                                    .put("return_url", "https://yourplatform.com/paypal/return")
                                    .put("cancel_url", "https://yourplatform.com/paypal/cancel")
                                    .put("shipping_preference", "GET_FROM_FILE"))));

    String json = MAPPER.writeValueAsString(root);

    HttpRequest request =
        HttpRequest.newBuilder()
            .uri(URI.create(baseUrl + "/v2/checkout/orders"))
            .timeout(Duration.ofSeconds(30))
            .header("Authorization", "Bearer " + accessToken)
            .header("Content-Type", "application/json")
            .header("PayPal-Auth-Assertion", authAssertionJwt)
            .header("PayPal-Partner-Attribution-Id", "PARTNER_BN_CODE")
            .POST(HttpRequest.BodyPublishers.ofString(json))
            .build();

    HttpResponse<String> response =
        http.send(request, HttpResponse.BodyHandlers.ofString());

    if (response.statusCode() / 100 != 2) {
      throw new IllegalStateException("create order failed: " + response.body());
    }

    return response.body();
  }
}
```

## Important

- **`purchase_units[].payee.merchant_id`**: seller (connected) merchant id.
- **`payment_instruction.platform_fees`**: platform cut; currency must match the transaction currency.
- **`payment_source.paypal.experience_context`**: payment-source UX (not legacy **`application_context`**).
- **`PayPal-Auth-Assertion`**: required for partner-initiated seller transactions per multiparty documentation.

Approve and capture on the client with the JS SDK using the returned **`id`**, then capture on the server (`multiparty-capture.md`).
