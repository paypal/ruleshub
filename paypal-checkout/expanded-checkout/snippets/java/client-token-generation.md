# Client token generation — PayPal Expanded Checkout (Spring Boot / Java)

The PayPal JS SDK (Card Fields, Fastlane, wallets) needs a **client token** obtained from your server. Expose a **GET** endpoint on your app that returns JSON the browser can pass to the SDK.

**PayPal OAuth (server-side):** `POST /v1/oauth2/token` with `grant_type=client_credentials` and **`response_type=client_token`** + **`intent=sdk_init`**.

- **Sandbox:** `https://api-m.sandbox.paypal.com/v1/oauth2/token`
- **Production:** `https://api-m.paypal.com/v1/oauth2/token`

Do not call PayPal from the browser with your client secret.

## HttpClient — fetch client token

```java
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.Base64;

public class PayPalClientTokenService {

  private final HttpClient http = HttpClient.newBuilder()
      .connectTimeout(Duration.ofSeconds(10))
      .build();
  private final ObjectMapper mapper = new ObjectMapper();
  private final String baseUrl;
  private final String clientId;
  private final String clientSecret;

  public PayPalClientTokenService(String baseUrl, String clientId, String clientSecret) {
    this.baseUrl = baseUrl.endsWith("/") ? baseUrl.substring(0, baseUrl.length() - 1) : baseUrl;
    this.clientId = clientId;
    this.clientSecret = clientSecret;
  }

  /**
   * Returns the client_token string for JS SDK initialization.
   */
  public String fetchClientToken() throws Exception {
    String basic = Base64.getEncoder().encodeToString(
        (clientId + ":" + clientSecret).getBytes(StandardCharsets.UTF_8));

    String form = "grant_type=client_credentials&response_type=client_token&intent=sdk_init";

    HttpRequest request = HttpRequest.newBuilder()
        .uri(URI.create(baseUrl + "/v1/oauth2/token"))
        .timeout(Duration.ofSeconds(30))
        .header("Authorization", "Basic " + basic)
        .header("Content-Type", "application/x-www-form-urlencoded")
        .POST(HttpRequest.BodyPublishers.ofString(form, StandardCharsets.UTF_8))
        .build();

    HttpResponse<String> response =
        http.send(request, HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8));

    if (response.statusCode() < 200 || response.statusCode() >= 300) {
      throw new IllegalStateException("OAuth client_token failed: " + response.statusCode() + " " + response.body());
    }

    JsonNode root = mapper.readTree(response.body());
    if (!root.hasNonNull("access_token")) {
      throw new IllegalStateException("Missing access_token (client token) in OAuth response");
    }
    return root.get("access_token").asText();
  }
}
```

Some responses also include `expires_in`; cache the token and refresh before expiry in production.

## Spring Boot — GET endpoint for the browser

```java
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

@RestController
@RequestMapping("/api/paypal")
public class PayPalClientTokenController {

  private final PayPalClientTokenService clientTokenService;

  public PayPalClientTokenController(PayPalClientTokenService clientTokenService) {
    this.clientTokenService = clientTokenService;
  }

  /**
   * Browser-friendly GET — returns client token for SDK init.
   * Adjust path/CORS to match your checkout page origin.
   */
  @GetMapping("/client-token")
  public ResponseEntity<Map<String, String>> getClientToken() throws Exception {
    String token = clientTokenService.fetchClientToken();
    return ResponseEntity.ok(Map.of("client_token", token));
  }
}
```

## Wiring

```java
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class PayPalClientTokenConfig {

  @Bean
  public PayPalClientTokenService payPalClientTokenService(
      @Value("${paypal.environment}") String env,
      @Value("${paypal.client-id}") String clientId,
      @Value("${paypal.client-secret}") String clientSecret) {
    String base = "production".equalsIgnoreCase(env)
        ? "https://api-m.paypal.com"
        : "https://api-m.sandbox.paypal.com";
    return new PayPalClientTokenService(base, clientId, clientSecret);
  }
}
```

## Summary

- **Your app:** `GET` endpoint returns `{ "client_token": "..." }` for the frontend.
- **PayPal:** `POST` `/v1/oauth2/token` with `response_type=client_token` and `intent=sdk_init`.
