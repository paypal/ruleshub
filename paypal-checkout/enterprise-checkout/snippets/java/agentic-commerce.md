# Agentic commerce / Store Sync — Cart API via `HttpClient`

**Store Sync** exposes product catalogs for AI agents; **Cart API** models carts server-side. Flow: **create cart** → buyer approves payment → **complete checkout** (or map cart to **Orders v2** / **Braintree** per your integration).

Use **`java.net.http.HttpClient`** for Cart operations and OAuth (same token as `seller-onboarding.md`).

REST bases: Sandbox **`https://api-m.sandbox.paypal.com`**, Production **`https://api-m.paypal.com`**.

## OAuth (reuse)

Use **`client_credentials`** token from your **`PayPalOAuthClient`** (`seller-onboarding.md`).

## `POST /v2/cart` — create

```java
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.UUID;

public class PayPalCartClient {

  private static final ObjectMapper MAPPER = new ObjectMapper();

  private final HttpClient http = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(30)).build();
  private final String baseUrl;

  public PayPalCartClient(String paypalEnvironment) {
    this.baseUrl =
        "production".equalsIgnoreCase(paypalEnvironment)
            ? "https://api-m.paypal.com"
            : "https://api-m.sandbox.paypal.com";
  }

  public JsonNode createCart(String accessToken, JsonNode cartPayload) throws Exception {
    HttpRequest request =
        HttpRequest.newBuilder()
            .uri(URI.create(baseUrl + "/v2/cart"))
            .timeout(Duration.ofSeconds(30))
            .header("Authorization", "Bearer " + accessToken)
            .header("Content-Type", "application/json")
            .header("PayPal-Request-Id", UUID.randomUUID().toString())
            .POST(HttpRequest.BodyPublishers.ofString(MAPPER.writeValueAsString(cartPayload)))
            .build();

    HttpResponse<String> response =
        http.send(request, HttpResponse.BodyHandlers.ofString());

    if (response.statusCode() / 100 != 2) {
      throw new IllegalStateException("create cart failed: " + response.body());
    }

    return MAPPER.readTree(response.body());
  }
```

Shape **`cartPayload`** per the current Cart API schema (intent, items, payee, experience context, etc.) in the [developer reference](https://docs.paypal.ai/reference/api/rest/cart-operations/create-cart).

## `GET /v2/cart/{cart_id}` — details

```java
  public JsonNode getCart(String accessToken, String cartId) throws Exception {
    String encoded = java.net.URLEncoder.encode(cartId, java.nio.charset.StandardCharsets.UTF_8);

    HttpRequest request =
        HttpRequest.newBuilder()
            .uri(URI.create(baseUrl + "/v2/cart/" + encoded))
            .timeout(Duration.ofSeconds(30))
            .header("Authorization", "Bearer " + accessToken)
            .GET()
            .build();

    HttpResponse<String> response =
        http.send(request, HttpResponse.BodyHandlers.ofString());

    if (response.statusCode() / 100 != 2) {
      throw new IllegalStateException("get cart failed: " + response.body());
    }

    return MAPPER.readTree(response.body());
  }
```

## `PATCH /v2/cart/{cart_id}` — update

```java
  public JsonNode patchCart(String accessToken, String cartId, JsonNode patchBody) throws Exception {
    String encoded = java.net.URLEncoder.encode(cartId, java.nio.charset.StandardCharsets.UTF_8);

    HttpRequest request =
        HttpRequest.newBuilder()
            .uri(URI.create(baseUrl + "/v2/cart/" + encoded))
            .timeout(Duration.ofSeconds(30))
            .header("Authorization", "Bearer " + accessToken)
            .header("Content-Type", "application/json")
            .header("PayPal-Request-Id", UUID.randomUUID().toString())
            .method("PATCH", HttpRequest.BodyPublishers.ofString(MAPPER.writeValueAsString(patchBody)))
            .build();

    HttpResponse<String> response =
        http.send(request, HttpResponse.BodyHandlers.ofString());

    if (response.statusCode() / 100 != 2) {
      throw new IllegalStateException("patch cart failed: " + response.body());
    }

    return MAPPER.readTree(response.body());
  }
```

## Convert cart to order / complete checkout

1. **Orders v2 path** — map cart totals to **`POST /v2/checkout/orders`** (`multiparty-create-order.md` for platform fees and **`experience_context`**).
2. **Complete Checkout** — call **Complete Checkout** after buyer approval per the current API contract ([reference](https://docs.paypal.ai/reference/api/rest/checkout/complete-checkout)).
3. **Braintree path** — tokenize on client, then **`gateway.transaction().sale`** (`braintree-transaction.md`); vault if needed (`braintree-vault.md`).

Keep **one source of truth** for amounts across cart, Orders, and Braintree to avoid reconciliation errors.

## Agent discovery

Agents use **Store Sync** catalog endpoints and merchant-configured agentic surfaces; carts created via API let the buyer finish in PayPal checkout or your web app depending on integration.
