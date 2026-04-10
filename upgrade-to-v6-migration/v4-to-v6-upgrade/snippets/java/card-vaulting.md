#### Create Order with Vault Directive

```java
import org.springframework.web.bind.annotation.*;
import org.springframework.http.*;
import org.springframework.web.client.RestTemplate;
import java.util.*;

@PostMapping("/create-with-vault")
public ResponseEntity<?> createOrderWithVault(@RequestBody Map<String, Object> requestBody) {
    try {
        String accessToken = tokenController.getAccessToken();
        
        Map<String, Object> amount = new HashMap<>();
        amount.put("currency_code", requestBody.getOrDefault("currency", "USD"));
        amount.put("value", requestBody.get("amount"));
        
        Map<String, Object> purchaseUnit = new HashMap<>();
        purchaseUnit.put("amount", amount);
        
        Map<String, Object> orderPayload = new HashMap<>();
        orderPayload.put("intent", "CAPTURE");
        orderPayload.put("purchase_units", Arrays.asList(purchaseUnit));
        
        if (Boolean.TRUE.equals(requestBody.get("saveCard"))) {
            Map<String, Object> vault = new HashMap<>();
            vault.put("store_in_vault", "ON_SUCCESS");
            vault.put("usage_type", "MERCHANT");
            vault.put("customer_type", "CONSUMER");
            vault.put("permit_multiple_payment_tokens", true);
            
            Map<String, Object> verification = new HashMap<>();
            verification.put("method", "SCA_WHEN_REQUIRED");
            
            Map<String, Object> attributes = new HashMap<>();
            attributes.put("verification", verification);
            attributes.put("vault", vault);
            
            Map<String, Object> card = new HashMap<>();
            card.put("attributes", attributes);
            
            Map<String, Object> paymentSource = new HashMap<>();
            paymentSource.put("card", card);
            
            orderPayload.put("payment_source", paymentSource);
        }
        
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

#### Create Order with Vault ID

```java
@PostMapping("/create-with-vault-id")
public ResponseEntity<?> createOrderWithVaultId(@RequestBody Map<String, Object> requestBody) {
    try {
        String accessToken = tokenController.getAccessToken();
        
        Map<String, Object> amount = new HashMap<>();
        amount.put("currency_code", requestBody.getOrDefault("currency", "USD"));
        amount.put("value", requestBody.get("amount"));
        
        Map<String, Object> purchaseUnit = new HashMap<>();
        purchaseUnit.put("amount", amount);
        
        Map<String, Object> card = new HashMap<>();
        card.put("vault_id", requestBody.get("vaultId"));
        
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
        
        Map<String, Object> orderData = response.getBody();
        String orderId = (String) orderData.get("id");
        
        ResponseEntity<Map> captureResponse = restTemplate.postForEntity(
            PAYPAL_BASE + "/v2/checkout/orders/" + orderId + "/capture",
            new HttpEntity<>(new HashMap<>(), headers),
            Map.class
        );
        
        return ResponseEntity.ok(captureResponse.getBody());
        
    } catch (Exception e) {
        Map<String, String> error = new HashMap<>();
        error.put("error", "PAYMENT_FAILED");
        return ResponseEntity.status(500).body(error);
    }
}
```

#### List Payment Tokens

```java
@GetMapping("/vault/payment-tokens")
public ResponseEntity<?> listPaymentTokens(@RequestParam String customerId) {
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
        
        return ResponseEntity.ok(response.getBody());
        
    } catch (Exception e) {
        Map<String, String> error = new HashMap<>();
        error.put("error", "FETCH_FAILED");
        return ResponseEntity.status(500).body(error);
    }
}
```

#### Delete Payment Token

```java
@DeleteMapping("/vault/payment-tokens/{tokenId}")
public ResponseEntity<?> deletePaymentToken(@PathVariable String tokenId) {
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
        result.put("message", "Card deleted successfully");
        return ResponseEntity.ok(result);
        
    } catch (Exception e) {
        Map<String, String> error = new HashMap<>();
        error.put("error", "DELETE_FAILED");
        return ResponseEntity.status(500).body(error);
    }
}
```

