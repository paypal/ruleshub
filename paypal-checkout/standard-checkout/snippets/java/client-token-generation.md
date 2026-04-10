# Client token generation — PayPal Standard Checkout (Spring Boot / Java)

Expose a **browser-safe client token** for the PayPal JS SDK (Advanced integrations, fraud tools, or flows that require a server-issued token). Your app obtains an OAuth token from PayPal with `response_type=client_token`, caches it until shortly before expiry, and returns only the client token string to the browser.

**App endpoint (example):** `GET /paypal-api/auth/browser-safe-client-token`

**PayPal OAuth:** `POST /v1/oauth2/token`

## OAuth request parameters

Use **Basic** authentication (Base64 of `client_id:client_secret`) and **form** body:

- `grant_type=client_credentials`
- `response_type=client_token`
- `intent=sdk_init`

Sandbox: `https://api-m.sandbox.paypal.com/v1/oauth2/token`  
Production: `https://api-m.paypal.com/v1/oauth2/token`

## Base64 Basic auth

```java
import java.nio.charset.StandardCharsets;
import java.util.Base64;

public final class PayPalAuthHeader {
  private PayPalAuthHeader() {}

  public static String basicAuth(String clientId, String clientSecret) {
    String raw = clientId + ":" + clientSecret;
    return "Basic " + Base64.getEncoder().encodeToString(raw.getBytes(StandardCharsets.UTF_8));
  }
}
```

## Token cache with expiration

Cache the **access token** response and refresh before expiry. OAuth responses include `expires_in` (seconds). Refresh when `Instant.now().isAfter(expiresAt.minusSeconds(60))` to allow clock skew.

```java
import java.time.Instant;
import java.util.concurrent.atomic.AtomicReference;

public final class CachedOAuthToken {
  private final AtomicReference<String> token = new AtomicReference<>();
  private volatile Instant expiresAt = Instant.EPOCH;

  public synchronized String getOrRefresh(TokenSupplier refresh) throws Exception {
    if (token.get() != null && Instant.now().isBefore(expiresAt.minusSeconds(60))) {
      return token.get();
    }
    OAuthResult r = refresh.fetch();
    token.set(r.accessToken());
    expiresAt = Instant.now().plusSeconds(Math.max(1, r.expiresInSeconds() - 30));
    return token.get();
  }

  @FunctionalInterface
  public interface TokenSupplier {
    OAuthResult fetch() throws Exception;
  }

  public record OAuthResult(String accessToken, long expiresInSeconds) {}
}
```

## HttpClient: fetch OAuth token (client_token)

```java
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.Objects;

public class PayPalOAuthClient {

  private final HttpClient http = HttpClient.newBuilder()
      .connectTimeout(Duration.ofSeconds(10))
      .build();
  private final ObjectMapper mapper = new ObjectMapper();
  private final String baseUrl;
  private final String clientId;
  private final String clientSecret;

  public PayPalOAuthClient(String baseUrl, String clientId, String clientSecret) {
    this.baseUrl = Objects.requireNonNull(baseUrl);
    this.clientId = Objects.requireNonNull(clientId);
    this.clientSecret = Objects.requireNonNull(clientSecret);
  }

  /**
   * Returns the access_token string suitable for Bearer use, or the client_token
   * embedded in the response when using response_type=client_token (parse JSON per PayPal docs).
   */
  public JsonNode postClientCredentialsToken() throws Exception {
    String body = "grant_type=client_credentials"
        + "&response_type=client_token"
        + "&intent=sdk_init";

    HttpRequest request = HttpRequest.newBuilder()
        .uri(URI.create(baseUrl + "/v1/oauth2/token"))
        .timeout(Duration.ofSeconds(15))
        .header("Authorization", PayPalAuthHeader.basicAuth(clientId, clientSecret))
        .header("Content-Type", "application/x-www-form-urlencoded")
        .POST(HttpRequest.BodyPublishers.ofString(body, StandardCharsets.UTF_8))
        .build();

    HttpResponse<String> response =
        http.send(request, HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8));

    if (response.statusCode() < 200 || response.statusCode() >= 300) {
      throw new IllegalStateException("OAuth failed: HTTP " + response.statusCode() + " " + response.body());
    }

    return mapper.readTree(response.body());
  }
}
```

Parse the JSON for `access_token`, `expires_in`, and any `access_token` / client token fields per the current PayPal OAuth response shape for your integration.

## Spring Boot controller

```java
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

import com.fasterxml.jackson.databind.JsonNode;

import java.util.Map;

@RestController
public class PayPalAuthController {

  private final PayPalOAuthClient oauth;
  private final CachedOAuthToken cache = new CachedOAuthToken();

  public PayPalAuthController(
      @Value("${paypal.mode}") String mode,
      @Value("${paypal.client-id}") String clientId,
      @Value("${paypal.client-secret}") String clientSecret) {
    String base = "live".equalsIgnoreCase(mode)
        ? "https://api-m.paypal.com"
        : "https://api-m.sandbox.paypal.com";
    this.oauth = new PayPalOAuthClient(base, clientId, clientSecret);
  }

  @GetMapping(value = "/paypal-api/auth/browser-safe-client-token", produces = MediaType.APPLICATION_JSON_VALUE)
  public ResponseEntity<Map<String, String>> browserSafeClientToken() throws Exception {
    String token = cache.getOrRefresh(() -> {
      JsonNode root = oauth.postClientCredentialsToken();
      long expiresIn = root.path("expires_in").asLong(3600);
      // OAuth with response_type=client_token: use access_token for Bearer or the client_token field per current API docs.
      String accessToken = root.path("access_token").asText(null);
      if (accessToken == null || accessToken.isBlank()) {
        throw new IllegalStateException("No access_token in OAuth response");
      }
      return new CachedOAuthToken.OAuthResult(accessToken, expiresIn);
    });

    return ResponseEntity.ok(Map.of("client_token", token));
  }
}
```

**Security:** Return only what the JS SDK needs (often a short-lived token). Never log full secrets or long-lived credentials. Use HTTPS for your API.

## Summary

- **Basic auth:** Base64(`client_id:client_secret`).
- **POST** `/v1/oauth2/token` with `grant_type=client_credentials`, `response_type=client_token`, `intent=sdk_init`.
- **Cache** using `expires_in` and refresh with margin before expiry.
