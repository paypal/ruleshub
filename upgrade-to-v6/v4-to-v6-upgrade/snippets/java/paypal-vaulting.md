#### Create Setup Token (Save PayPal Without Purchase)

```java
import org.springframework.web.bind.annotation.*;
import org.springframework.http.*;
import org.springframework.web.client.RestTemplate;
import java.util.*;

@PostMapping("/vault/setup-token/create")
public ResponseEntity<?> createSetupToken() {
    try {
        String accessToken = tokenController.getAccessToken();
        
        Map<String, Object> paypal = new HashMap<>();
        paypal.put("usage_type", "MERCHANT");
        paypal.put("customer_type", "CONSUMER");
        paypal.put("permit_multiple_payment_tokens", true);
        
        Map<String, Object> paymentSource = new HashMap<>();
        paymentSource.put("paypal", paypal);
        
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
        
        Map<String, Object> setupData = response.getBody();
        
        Map<String, Object> result = new HashMap<>();
        result.put("id", setupData.get("id"));
        result.put("status", setupData.get("status"));
        
        return ResponseEntity.ok(result);
        
    } catch (Exception e) {
        Map<String, String> error = new HashMap<>();
        error.put("error", "SETUP_TOKEN_FAILED");
        return ResponseEntity.status(500).body(error);
    }
}
```

#### Create Payment Token from Setup Token

```java
@PostMapping("/vault/payment-token/create")
public ResponseEntity<?> createPaymentToken(@RequestBody Map<String, Object> requestBody) {
    try {
        String accessToken = tokenController.getAccessToken();
        
        Map<String, Object> token = new HashMap<>();
        token.put("id", requestBody.get("vaultSetupToken"));
        token.put("type", "SETUP_TOKEN");
        
        Map<String, Object> paymentSource = new HashMap<>();
        paymentSource.put("token", token);
        
        Map<String, Object> paymentTokenPayload = new HashMap<>();
        paymentTokenPayload.put("payment_source", paymentSource);
        
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        headers.set("Authorization", "Bearer " + accessToken);
        headers.set("PayPal-Request-Id", UUID.randomUUID().toString());
        
        HttpEntity<Map<String, Object>> request = new HttpEntity<>(paymentTokenPayload, headers);
        
        ResponseEntity<Map> response = restTemplate.postForEntity(
            PAYPAL_BASE + "/v3/vault/payment-tokens",
            request,
            Map.class
        );
        
        Map<String, Object> tokenData = response.getBody();
        String paymentTokenId = (String) tokenData.get("id");
        Map<String, Object> customer = (Map<String, Object>) tokenData.get("customer");
        String customerId = (String) customer.get("id");
        
        Map<String, Object> result = new HashMap<>();
        result.put("id", paymentTokenId);
        result.put("customerId", customerId);
        result.put("status", "saved");
        
        return ResponseEntity.ok(result);
        
    } catch (Exception e) {
        Map<String, String> error = new HashMap<>();
        error.put("error", "PAYMENT_TOKEN_FAILED");
        return ResponseEntity.status(500).body(error);
    }
}
```

#### Create Order with Saved PayPal

```java
@PostMapping("/create-with-payment-token")
public ResponseEntity<?> createOrderWithPaymentToken(@RequestBody Map<String, Object> requestBody) {
    try {
        String accessToken = tokenController.getAccessToken();
        
        Map<String, Object> amount = new HashMap<>();
        amount.put("currency_code", requestBody.getOrDefault("currency", "USD"));
        amount.put("value", requestBody.get("amount"));
        
        Map<String, Object> purchaseUnit = new HashMap<>();
        purchaseUnit.put("amount", amount);
        
        Map<String, Object> paypal = new HashMap<>();
        paypal.put("vault_id", requestBody.get("paymentTokenId"));
        
        Map<String, Object> paymentSource = new HashMap<>();
        paymentSource.put("paypal", paypal);
        
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
        
        Map<String, Object> orderData = response.getBody();
        
        if ("CREATED".equals(orderData.get("status"))) {
            String orderId = (String) orderData.get("id");
            ResponseEntity<Map> captureResponse = restTemplate.postForEntity(
                PAYPAL_BASE + "/v2/checkout/orders/" + orderId + "/capture",
                new HttpEntity<>(new HashMap<>(), headers),
                Map.class
            );
            return ResponseEntity.ok(captureResponse.getBody());
        }
        
        return ResponseEntity.ok(orderData);
        
    } catch (Exception e) {
        Map<String, String> error = new HashMap<>();
        error.put("error", "ORDER_FAILED");
        return ResponseEntity.status(500).body(error);
    }
}
```

#### List Saved Payment Methods

```java
@GetMapping("/customer/payment-methods")
public ResponseEntity<?> listPaymentMethods(@RequestParam String customerId) {
    try {
        String accessToken = tokenController.getAccessToken();
        
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        headers.set("Authorization", "Bearer " + accessToken);
        
        HttpEntity<?> request = new HttpEntity<>(headers);
        
        ResponseEntity<Map> response = restTemplate.exchange(
            PAYPAL_BASE + "/v3/vault/payment-tokens?customer_id=" + customerId,
            HttpMethod.GET,
            request,
            Map.class
        );
        
        Map<String, Object> tokensData = response.getBody();
        List<Map<String, Object>> paymentTokens = (List<Map<String, Object>>) tokensData.getOrDefault("payment_tokens", new ArrayList<>());
        
        Map<String, Object> result = new HashMap<>();
        result.put("payment_tokens", paymentTokens);
        result.put("total_items", paymentTokens.size());
        
        return ResponseEntity.ok(result);
        
    } catch (Exception e) {
        Map<String, String> error = new HashMap<>();
        error.put("error", "FETCH_FAILED");
        return ResponseEntity.status(500).body(error);
    }
}
```

#### Delete Saved Payment Method

```java
@DeleteMapping("/vault/payment-tokens/{tokenId}")
public ResponseEntity<?> deletePaymentMethod(@PathVariable String tokenId) {
    try {
        String accessToken = tokenController.getAccessToken();
        
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        headers.set("Authorization", "Bearer " + accessToken);
        
        HttpEntity<?> request = new HttpEntity<>(headers);
        
        restTemplate.exchange(
            PAYPAL_BASE + "/v3/vault/payment-tokens/" + tokenId,
            HttpMethod.DELETE,
            request,
            Void.class
        );
        
        Map<String, Object> result = new HashMap<>();
        result.put("success", true);
        result.put("message", "Payment method deleted");
        
        return ResponseEntity.ok(result);
        
    } catch (Exception e) {
        Map<String, String> error = new HashMap<>();
        error.put("error", "DELETE_FAILED");
        return ResponseEntity.status(500).body(error);
    }
}
```

