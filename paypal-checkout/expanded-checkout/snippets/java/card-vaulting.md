# Card vaulting — PayPal Expanded Checkout (Spring Boot / `HttpClient`)

Save cards **with** a purchase, **without** a purchase (setup + payment tokens), or **charge** a saved instrument. Use **`payment_source.card`** for order bodies — not top-level `application_context`.

**REST bases:** Sandbox `https://api-m.sandbox.paypal.com`, Production `https://api-m.paypal.com`.

## With purchase — `store_in_vault` on create order

Include vaulting under **`payment_source.card.attributes.vault`**:

```json
{
  "intent": "CAPTURE",
  "purchase_units": [
    { "amount": { "currency_code": "USD", "value": "50.00" } }
  ],
  "payment_source": {
    "card": {
      "experience_context": {
        "return_url": "https://yoursite.com/paypal/return",
        "cancel_url": "https://yoursite.com/paypal/cancel"
      },
      "attributes": {
        "vault": {
          "store_in_vault": "ON_SUCCESS"
        },
        "verification": {
          "method": "SCA_WHEN_REQUIRED"
        }
      }
    }
  }
}
```

On success, listen for **`VAULT.PAYMENT-TOKEN.CREATED`** (`webhooks.md`) and persist the token **server-side** only.

## Without purchase — Vault API (illustrative)

| Step | Method | Path |
|------|--------|------|
| Setup token | POST | `/v3/vault/setup-tokens` |
| Payment token | POST | `/v3/vault/payment-tokens` |

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

public class PayPalVaultClient {

  private final HttpClient http = HttpClient.newBuilder()
      .connectTimeout(Duration.ofSeconds(10))
      .build();
  private final ObjectMapper mapper = new ObjectMapper();
  private final String baseUrl;
  private final PayPalTokenProvider tokens;

  public PayPalVaultClient(String baseUrl, PayPalTokenProvider tokens) {
    this.baseUrl = baseUrl.endsWith("/") ? baseUrl.substring(0, baseUrl.length() - 1) : baseUrl;
    this.tokens = tokens;
  }

  /** Create setup token — body per current Vault v3 docs. */
  public String createSetupToken(Map<String, Object> body) throws Exception {
    String json = mapper.writeValueAsString(body);
    HttpRequest request = HttpRequest.newBuilder()
        .uri(URI.create(baseUrl + "/v3/vault/setup-tokens"))
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

The JS SDK still collects card data; your server exchanges tokens per PayPal’s vault flow.

## Use saved card — `vault_id` on order

```json
{
  "intent": "CAPTURE",
  "purchase_units": [
    { "amount": { "currency_code": "USD", "value": "25.00" } }
  ],
  "payment_source": {
    "card": {
      "vault_id": "PAYMENT_TOKEN_ID_FROM_YOUR_DB"
    }
  }
}
```

Map **`vault_id`** from your user’s stored PayPal payment token (never from untrusted client input without server checks).

## Security

- Store payment tokens **only** on the server; encrypt at rest.
- Tie tokens to authenticated customers and support deletion.

## References

- [Save cards with purchase (v6)](https://docs.paypal.ai/payments/save/sdk/cards/js-sdk-v6-vault)
- [Vault API](https://docs.paypal.ai/payments/save/api/vault-api-integration)
