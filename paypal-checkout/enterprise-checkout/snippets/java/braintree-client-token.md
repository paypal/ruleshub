# Braintree client token — `BraintreeGateway.clientToken().generate()` (Spring Boot 3)

Generate a **client token** on the server with **`gateway.clientToken().generate()`**. The browser uses it to initialize Drop-in, Hosted Fields, or 3DS. Optionally pass **`customerId`** to vault or show saved payment methods.

## `BraintreeGateway` bean (outline)

```java
import com.braintreegateway.BraintreeGateway;
import com.braintreegateway.Environment;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class BraintreeConfig {

  @Bean
  public BraintreeGateway braintreeGateway(
      @Value("${braintree.merchant-id}") String merchantId,
      @Value("${braintree.public-key}") String publicKey,
      @Value("${braintree.private-key}") String privateKey,
      @Value("${braintree.environment:Sandbox}") String envName) {

    Environment env =
        "Production".equalsIgnoreCase(envName) ? Environment.PRODUCTION : Environment.SANDBOX;

    return new BraintreeGateway(env, merchantId, publicKey, privateKey);
  }
}
```

## GET `/api/braintree/client-token` — minimal

```java
import com.braintreegateway.BraintreeGateway;
import com.braintreegateway.ClientTokenRequest;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

@RestController
public class BraintreeClientTokenController {

  private final BraintreeGateway gateway;

  public BraintreeClientTokenController(BraintreeGateway gateway) {
    this.gateway = gateway;
  }

  @GetMapping("/api/braintree/client-token")
  public ResponseEntity<Map<String, String>> clientToken() {
    String token = gateway.clientToken().generate();
    return ResponseEntity.ok(Map.of("client_token", token));
  }
}
```

## Optional `customerId` (vault / returning buyer)

Pass a Braintree **customer id** so the client can display vaulted payment methods (Drop-in `vaultManager`, etc.).

```java
  @GetMapping("/api/braintree/client-token")
  public ResponseEntity<Map<String, String>> clientToken(
      @RequestParam(required = false) String customerId) {

    ClientTokenRequest request = new ClientTokenRequest();
    if (customerId != null && !customerId.isBlank()) {
      request.customerId(customerId);
    }

    String token = gateway.clientToken().generate(request);
    return ResponseEntity.ok(Map.of("client_token", token));
  }
```

## Error handling

- On failure, `generate()` throws — return **502** and log internally; never expose private keys.
- Validate **`customerId`** belongs to the signed-in user before passing it to `generate()`.

## Related

- `drop-in-ui-integration.md` — consume `client_token` in the browser.
- `braintree-vault.md` — create customers before passing `customerId`.
