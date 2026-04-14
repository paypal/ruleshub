#### Create Order with 3D Secure (Always)

```java
import org.springframework.web.bind.annotation.*;
import org.springframework.http.*;
import org.springframework.web.client.RestTemplate;
import java.util.*;

@PostMapping("/create-3ds")
public ResponseEntity<?> createOrderWith3DS(@RequestBody Map<String, Object> requestBody) {
    try {
        String accessToken = tokenController.getAccessToken();
        
        Map<String, Object> amount = new HashMap<>();
        amount.put("currency_code", requestBody.getOrDefault("currency", "USD"));
        amount.put("value", requestBody.get("amount"));
        
        Map<String, Object> purchaseUnit = new HashMap<>();
        purchaseUnit.put("amount", amount);
        
        Map<String, Object> experienceContext = new HashMap<>();
        experienceContext.put("return_url", "https://example.com/returnUrl");
        experienceContext.put("cancel_url", "https://example.com/cancelUrl");
        
        Map<String, Object> verification = new HashMap<>();
        verification.put("method", "SCA_ALWAYS");
        
        Map<String, Object> attributes = new HashMap<>();
        attributes.put("verification", verification);
        
        Map<String, Object> card = new HashMap<>();
        card.put("attributes", attributes);
        card.put("experience_context", experienceContext);
        
        Map<String, Object> paymentSource = new HashMap<>();
        paymentSource.put("card", card);
        
        Map<String, Object> orderPayload = new HashMap<>();
        orderPayload.put("intent", "CAPTURE");
        orderPayload.put("purchase_units", Arrays.asList(purchaseUnit));
        orderPayload.put("payment_source", paymentSource);
        
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        headers.set("Authorization", "Bearer " + accessToken);
        headers.set("PayPal-Request-Id", UUID.randomUUID().toString());
        
        HttpEntity<Map<String, Object>> request = new HttpEntity<>(orderPayload, headers);
        
        ResponseEntity<Map> response = restTemplate.postForEntity(
            PAYPAL_BASE + "/v2/checkout/orders",
            request,
            Map.class
        );
        
        return ResponseEntity.status(response.getStatusCode()).body(response.getBody());
        
    } catch (Exception e) {
        Map<String, String> error = new HashMap<>();
        error.put("error", "ORDER_CREATION_FAILED");
        return ResponseEntity.status(500).body(error);
    }
}
```

#### Create Order with SCA When Required

```java
@PostMapping("/create-sca")
public ResponseEntity<?> createOrderWithSCA(@RequestBody Map<String, Object> requestBody) {
    try {
        String accessToken = tokenController.getAccessToken();
        
        Map<String, Object> amount = new HashMap<>();
        amount.put("currency_code", requestBody.getOrDefault("currency", "USD"));
        amount.put("value", requestBody.get("amount"));
        
        Map<String, Object> purchaseUnit = new HashMap<>();
        purchaseUnit.put("amount", amount);
        
        Map<String, Object> experienceContext = new HashMap<>();
        experienceContext.put("return_url", "https://example.com/returnUrl");
        experienceContext.put("cancel_url", "https://example.com/cancelUrl");
        
        Map<String, Object> verification = new HashMap<>();
        verification.put("method", "SCA_WHEN_REQUIRED");
        
        Map<String, Object> attributes = new HashMap<>();
        attributes.put("verification", verification);
        
        Map<String, Object> card = new HashMap<>();
        card.put("attributes", attributes);
        card.put("experience_context", experienceContext);
        
        Map<String, Object> paymentSource = new HashMap<>();
        paymentSource.put("card", card);
        
        Map<String, Object> orderPayload = new HashMap<>();
        orderPayload.put("intent", "CAPTURE");
        orderPayload.put("purchase_units", Arrays.asList(purchaseUnit));
        orderPayload.put("payment_source", paymentSource);
        
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        headers.set("Authorization", "Bearer " + accessToken);
        headers.set("PayPal-Request-Id", UUID.randomUUID().toString());
        
        HttpEntity<Map<String, Object>> request = new HttpEntity<>(orderPayload, headers);
        
        ResponseEntity<Map> response = restTemplate.postForEntity(
            PAYPAL_BASE + "/v2/checkout/orders",
            request,
            Map.class
        );
        
        return ResponseEntity.status(response.getStatusCode()).body(response.getBody());
        
    } catch (Exception e) {
        Map<String, String> error = new HashMap<>();
        error.put("error", "ORDER_CREATION_FAILED");
        return ResponseEntity.status(500).body(error);
    }
}
```

#### Vault Setup Token with 3DS

```java
@PostMapping("/vault/setup-token-3ds")
public ResponseEntity<?> createVaultSetupTokenWith3DS(@RequestBody Map<String, Object> requestBody) {
    try {
        String accessToken = tokenController.getAccessToken();
        
        Map<String, Object> experienceContext = new HashMap<>();
        experienceContext.put("return_url", "https://example.com/returnUrl");
        experienceContext.put("cancel_url", "https://example.com/cancelUrl");
        
        Map<String, Object> card = new HashMap<>();
        card.put("experience_context", experienceContext);
        card.put("verification_method", requestBody.getOrDefault("scaMethod", "SCA_WHEN_REQUIRED"));
        
        Map<String, Object> paymentSource = new HashMap<>();
        paymentSource.put("card", card);
        
        Map<String, Object> setupTokenPayload = new HashMap<>();
        setupTokenPayload.put("payment_source", paymentSource);
        
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        headers.set("Authorization", "Bearer " + accessToken);
        headers.set("PayPal-Request-Id", UUID.randomUUID().toString());
        
        HttpEntity<Map<String, Object>> request = new HttpEntity<>(setupTokenPayload, headers);
        
        ResponseEntity<Map> response = restTemplate.postForEntity(
            PAYPAL_BASE + "/v3/vault/setup-tokens",
            request,
            Map.class
        );
        
        return ResponseEntity.ok(response.getBody());
        
    } catch (Exception e) {
        Map<String, String> error = new HashMap<>();
        error.put("error", "SETUP_TOKEN_FAILED");
        return ResponseEntity.status(500).body(error);
    }
}
```

#### Capture with 3DS Logging

```java
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

@PostMapping("/{orderId}/capture-3ds")
public ResponseEntity<?> captureWith3DSLogging(@PathVariable String orderId) {
    Logger logger = LoggerFactory.getLogger(getClass());
    
    try {
        String accessToken = tokenController.getAccessToken();
        
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        headers.set("Authorization", "Bearer " + accessToken);
        headers.set("PayPal-Request-Id", UUID.randomUUID().toString());
        
        HttpEntity<Map<String, Object>> request = new HttpEntity<>(new HashMap<>(), headers);
        
        ResponseEntity<Map> response = restTemplate.postForEntity(
            PAYPAL_BASE + "/v2/checkout/orders/" + orderId + "/capture",
            request,
            Map.class
        );
        
        Map<String, Object> captureData = response.getBody();
        Map<String, Object> paymentSource = (Map<String, Object>) captureData.get("payment_source");
        
        if (paymentSource != null) {
            Map<String, Object> card = (Map<String, Object>) paymentSource.get("card");
            if (card != null) {
                Map<String, Object> authResult = (Map<String, Object>) card.get("authentication_result");
                if (authResult != null) {
                    Map<String, Object> threeDS = (Map<String, Object>) authResult.get("three_d_secure");
                    logger.info("3DS Authentication Result:");
                    logger.info("  Order ID: {}", captureData.get("id"));
                    logger.info("  Liability Shift: {}", authResult.get("liability_shift"));
                    logger.info("  Auth Status: {}", threeDS != null ? threeDS.get("authentication_status") : "N/A");
                    logger.info("  Enrollment Status: {}", threeDS != null ? threeDS.get("enrollment_status") : "N/A");
                }
            }
        }
        
        return ResponseEntity.ok(captureData);
        
    } catch (Exception e) {
        Map<String, String> error = new HashMap<>();
        error.put("error", "CAPTURE_FAILED");
        return ResponseEntity.status(500).body(error);
    }
}
```

