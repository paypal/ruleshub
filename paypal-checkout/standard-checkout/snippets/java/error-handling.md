# Error handling — PayPal Standard Checkout (Spring Boot / Java)

Handle **HTTP errors** from `java.net.http.HttpClient`, surface **PayPal JSON errors** to logs (not always to end users), and extract **`PayPal-Debug-Id`** from response headers for PayPal Merchant Support.

## PayPal API exception type

```java
import java.net.http.HttpHeaders;
import java.util.Optional;

public class PayPalApiException extends RuntimeException {

  private final int statusCode;
  private final String responseBody;
  private final Optional<String> debugId;

  public PayPalApiException(int statusCode, String responseBody, HttpHeaders headers) {
    super("PayPal API HTTP " + statusCode);
    this.statusCode = statusCode;
    this.responseBody = responseBody;
    this.debugId = headers == null ? Optional.empty() : headers.firstValue("PayPal-Debug-Id");
  }

  public int getStatusCode() {
    return statusCode;
  }

  public String getResponseBody() {
    return responseBody;
  }

  public Optional<String> getDebugId() {
    return debugId;
  }
}
```

## Extract Debug ID from any response

```java
import java.net.http.HttpHeaders;
import java.util.Optional;

public final class PayPalHeaders {
  private PayPalHeaders() {}

  public static Optional<String> debugId(HttpHeaders headers) {
    return headers.firstValue("PayPal-Debug-Id");
  }
}
```

## HttpClient error handling pattern

```java
import java.net.http.HttpResponse;

public final class PayPalHttpResponses {
  private PayPalHttpResponses() {}

  public static void throwIfError(HttpResponse<String> response) {
    int code = response.statusCode();
    if (code >= 200 && code < 300) {
      return;
    }
    throw new PayPalApiException(code, response.body(), response.headers());
  }
}
```

Call `throwIfError(response)` after `http.send(...)` in your clients instead of duplicating range checks.

## Spring Boot `@ControllerAdvice`

```java
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

import java.util.Map;

@RestControllerAdvice
public class PayPalExceptionHandlers {

  private static final Logger log = LoggerFactory.getLogger(PayPalExceptionHandlers.class);

  @ExceptionHandler(PayPalApiException.class)
  public ResponseEntity<Map<String, Object>> paypalApi(PayPalApiException ex) {
    ex.getDebugId().ifPresent(id -> log.warn("PayPal error debug_id={} status={} body={}",
        id, ex.getStatusCode(), truncate(ex.getResponseBody(), 2000)));

    HttpStatus status = HttpStatus.resolve(ex.getStatusCode());
    if (status == null) {
      status = HttpStatus.BAD_GATEWAY;
    }
    if (ex.getStatusCode() >= 400 && ex.getStatusCode() < 500) {
      status = HttpStatus.BAD_REQUEST;
    }

    return ResponseEntity.status(status).body(Map.of(
        "error", "paypal_request_failed",
        "paypal_debug_id", ex.getDebugId().orElse("")
    ));
  }

  @ExceptionHandler(IllegalArgumentException.class)
  public ResponseEntity<Map<String, String>> badRequest(IllegalArgumentException ex) {
    return ResponseEntity.badRequest().body(Map.of("error", ex.getMessage()));
  }

  private static String truncate(String s, int max) {
    if (s == null) return "";
    return s.length() <= max ? s : s.substring(0, max) + "...";
  }
}
```

Avoid returning raw PayPal bodies to browsers; log them server-side with `PayPal-Debug-Id`.

## OAuth token provider (interface)

```java
public interface PayPalTokenProvider {
  String getAccessToken();
}
```

Implement with cached OAuth `client_credentials` token and refresh on expiry (`client-token-generation.md`).

## Retry logic (transient failures)

Retry **only** idempotent operations or those using **`PayPal-Request-Id`**, and only for **5xx** or **429** with backoff.

```java
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.concurrent.ThreadLocalRandom;

public final class HttpRetry {
  private HttpRetry() {}

  public static HttpResponse<String> sendWithRetry(HttpClient client, HttpRequest request, int maxAttempts)
      throws Exception {
    Exception last = null;
    for (int attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        HttpResponse<String> response = client.send(request, HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8));
        int code = response.statusCode();
        if (code == 429 || code >= 500) {
          sleepBackoff(attempt);
          continue;
        }
        return response;
      } catch (Exception e) {
        last = e;
        if (attempt == maxAttempts) {
          break;
        }
        sleepBackoff(attempt);
      }
    }
    if (last != null) {
      throw last;
    }
    throw new IllegalStateException("retry exhausted");
  }

  private static void sleepBackoff(int attempt) throws InterruptedException {
    long base = Math.min(2000L * attempt, 10_000L);
    long jitter = ThreadLocalRandom.current().nextLong(0, 250);
    Thread.sleep(Duration.ofMillis(base + jitter));
  }
}
```

**Note:** Replaying a **POST** without idempotency can duplicate side effects; prefer **`PayPal-Request-Id`** on create/refund/capture where documented.

## OkHttp equivalent (optional)

```java
import okhttp3.MediaType;
import okhttp3.OkHttpClient;
import okhttp3.Request;
import okhttp3.RequestBody;
import okhttp3.Response;

import java.io.IOException;
import java.util.concurrent.TimeUnit;

public class OkHttpPayPalExample {

  private final OkHttpClient client = new OkHttpClient.Builder()
      .connectTimeout(10, TimeUnit.SECONDS)
      .readTimeout(30, TimeUnit.SECONDS)
      .build();

  public String postJson(String url, String bearerToken, String json) throws IOException {
    Request request = new Request.Builder()
        .url(url)
        .header("Authorization", "Bearer " + bearerToken)
        .header("Content-Type", "application/json")
        .post(RequestBody.create(json, MediaType.parse("application/json")))
        .build();

    try (Response response = client.newCall(request).execute()) {
      String body = response.body() != null ? response.body().string() : "";
      if (!response.isSuccessful()) {
        throw new PayPalApiException(response.code(), body, null); // map OkHttp headers if needed
      }
      return body;
    }
  }
}
```

For OkHttp, read `PayPal-Debug-Id` via `response.header("PayPal-Debug-Id")`.

## Summary

- Map **4xx** from PayPal to **400/404** in your API as appropriate; use **502/503** for upstream failures when appropriate.
- Always log **`PayPal-Debug-Id`** when a PayPal call fails.
- Use **retries** with care and **idempotency keys** where PayPal supports them.
