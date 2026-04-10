# Pay Later Server-Side (Java/Spring Boot) — US

Server-side order creation and capture for Pay Later. No special order payload is needed.

Source: https://docs.paypal.ai/reference/api/rest/orders/create-order

## Spring Boot Implementation

```java
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.*;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.client.RestTemplate;

import java.util.*;

@RestController
@RequestMapping("/paypal-api/checkout/orders")
public class PayPalOrderController {

    @Value("${paypal.client-id}")
    private String clientId;

    @Value("${paypal.client-secret}")
    private String clientSecret;

    @Value("${paypal.base-url:https://api-m.sandbox.paypal.com}")
    private String baseUrl;

    private final RestTemplate restTemplate = new RestTemplate();

    private String getAccessToken() {
        String auth = Base64.getEncoder()
            .encodeToString((clientId + ":" + clientSecret).getBytes());

        HttpHeaders headers = new HttpHeaders();
        headers.set("Authorization", "Basic " + auth);
        headers.setContentType(MediaType.APPLICATION_FORM_URLENCODED);

        HttpEntity<String> request = new HttpEntity<>(
            "grant_type=client_credentials", headers
        );

        ResponseEntity<Map> response = restTemplate.postForEntity(
            baseUrl + "/v1/oauth2/token", request, Map.class
        );

        return (String) response.getBody().get("access_token");
    }

    @PostMapping("/create")
    public ResponseEntity<?> createOrder(@RequestBody Map<String, Object> body) {
        try {
            String accessToken = getAccessToken();
            String amount = String.format("%.2f", Double.parseDouble(body.get("amount").toString()));
            String currencyCode = body.getOrDefault("currency_code", "USD").toString();

            Map<String, Object> amountObj = Map.of(
                "currency_code", currencyCode,
                "value", amount
            );
            Map<String, Object> purchaseUnit = Map.of("amount", amountObj);
            Map<String, Object> orderPayload = Map.of(
                "intent", "CAPTURE",
                "purchase_units", List.of(purchaseUnit)
            );

            HttpHeaders headers = new HttpHeaders();
            headers.set("Authorization", "Bearer " + accessToken);
            headers.setContentType(MediaType.APPLICATION_JSON);
            headers.set("PayPal-Request-Id", UUID.randomUUID().toString());

            HttpEntity<Map<String, Object>> request = new HttpEntity<>(orderPayload, headers);

            ResponseEntity<Map> response = restTemplate.postForEntity(
                baseUrl + "/v2/checkout/orders", request, Map.class
            );

            return ResponseEntity.status(response.getStatusCode()).body(response.getBody());

        } catch (Exception e) {
            return ResponseEntity.status(500)
                .body(Map.of("error", "ORDER_CREATION_FAILED"));
        }
    }

    @PostMapping("/{orderId}/capture")
    public ResponseEntity<?> captureOrder(@PathVariable String orderId) {
        try {
            String accessToken = getAccessToken();

            HttpHeaders headers = new HttpHeaders();
            headers.set("Authorization", "Bearer " + accessToken);
            headers.setContentType(MediaType.APPLICATION_JSON);
            headers.set("PayPal-Request-Id", UUID.randomUUID().toString());

            HttpEntity<String> request = new HttpEntity<>("", headers);

            ResponseEntity<Map> response = restTemplate.postForEntity(
                baseUrl + "/v2/checkout/orders/" + orderId + "/capture",
                request, Map.class
            );

            return ResponseEntity.status(response.getStatusCode()).body(response.getBody());

        } catch (Exception e) {
            return ResponseEntity.status(500)
                .body(Map.of("error", "CAPTURE_FAILED"));
        }
    }
}
```

## Key Points

- No special API fields for Pay Later — standard `POST /v2/checkout/orders` works
- Use `intent: CAPTURE` for Pay Later transactions
- Store credentials in `application.properties` or environment variables, never in code
- US Pay in 4: $30–$1,500; Pay Monthly: $49–$10,000
