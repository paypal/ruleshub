#### Create Order with AUTHORIZE Intent

```java
import org.springframework.web.bind.annotation.*;
import org.springframework.http.*;
import org.springframework.web.client.RestTemplate;
import java.util.*;

@PostMapping("/create-authorize")
public ResponseEntity<?> createOrderAuthorize(@RequestBody Map<String, Object> requestBody) {
    try {
        String accessToken = tokenController.getAccessToken();
        
        Map<String, Object> amount = new HashMap<>();
        amount.put("currency_code", requestBody.getOrDefault("currency", "USD"));
        amount.put("value", requestBody.get("amount"));
        
        Map<String, Object> purchaseUnit = new HashMap<>();
        purchaseUnit.put("amount", amount);
        
        Map<String, Object> orderPayload = new HashMap<>();
        orderPayload.put("intent", "AUTHORIZE");
        orderPayload.put("purchase_units", Arrays.asList(purchaseUnit));
        
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

#### Authorize Order

```java
@PostMapping("/{orderId}/authorize")
public ResponseEntity<?> authorizeOrder(@PathVariable String orderId) {
    try {
        String accessToken = tokenController.getAccessToken();
        
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        headers.set("Authorization", "Bearer " + accessToken);
        headers.set("PayPal-Request-Id", UUID.randomUUID().toString());
        
        HttpEntity<Map<String, Object>> request = new HttpEntity<>(new HashMap<>(), headers);
        
        ResponseEntity<Map> response = restTemplate.postForEntity(
            PAYPAL_BASE + "/v2/checkout/orders/" + orderId + "/authorize",
            request,
            Map.class
        );
        
        Map<String, Object> authData = response.getBody();
        List<Map<String, Object>> purchaseUnits = (List<Map<String, Object>>) authData.get("purchase_units");
        Map<String, Object> payments = (Map<String, Object>) purchaseUnits.get(0).get("payments");
        List<Map<String, Object>> authorizations = (List<Map<String, Object>>) payments.get("authorizations");
        String authorizationId = (String) authorizations.get(0).get("id");
        
        Map<String, Object> result = new HashMap<>();
        result.put("authorizationId", authorizationId);
        result.put("status", authData.get("status"));
        result.put("details", authData);
        
        return ResponseEntity.ok(result);
        
    } catch (Exception e) {
        Map<String, String> error = new HashMap<>();
        error.put("error", "AUTHORIZATION_FAILED");
        return ResponseEntity.status(500).body(error);
    }
}
```

#### Capture Authorization

```java
@PostMapping("/payments/authorizations/{authorizationId}/capture")
public ResponseEntity<?> captureAuthorization(
        @PathVariable String authorizationId,
        @RequestBody Map<String, Object> requestBody) {
    try {
        String accessToken = tokenController.getAccessToken();
        
        Map<String, Object> capturePayload = new HashMap<>();
        
        if (requestBody.containsKey("amount")) {
            Map<String, Object> amount = new HashMap<>();
            amount.put("value", requestBody.get("amount"));
            amount.put("currency_code", requestBody.getOrDefault("currency", "USD"));
            capturePayload.put("amount", amount);
        }
        
        capturePayload.put("final_capture", requestBody.getOrDefault("finalCapture", true));
        
        if (requestBody.containsKey("invoiceId")) {
            capturePayload.put("invoice_id", requestBody.get("invoiceId"));
        }
        
        if (requestBody.containsKey("noteToPayer")) {
            capturePayload.put("note_to_payer", requestBody.get("noteToPayer"));
        }
        
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        headers.set("Authorization", "Bearer " + accessToken);
        headers.set("PayPal-Request-Id", UUID.randomUUID().toString());
        
        HttpEntity<Map<String, Object>> request = new HttpEntity<>(capturePayload, headers);
        
        ResponseEntity<Map> response = restTemplate.postForEntity(
            PAYPAL_BASE + "/v2/payments/authorizations/" + authorizationId + "/capture",
            request,
            Map.class
        );
        
        return ResponseEntity.ok(response.getBody());
        
    } catch (Exception e) {
        Map<String, String> error = new HashMap<>();
        error.put("error", "CAPTURE_FAILED");
        return ResponseEntity.status(500).body(error);
    }
}
```

#### Get Authorization Details

```java
@GetMapping("/payments/authorizations/{authorizationId}")
public ResponseEntity<?> getAuthorizationDetails(@PathVariable String authorizationId) {
    try {
        String accessToken = tokenController.getAccessToken();
        
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        headers.set("Authorization", "Bearer " + accessToken);
        
        HttpEntity<?> request = new HttpEntity<>(headers);
        
        ResponseEntity<Map> response = restTemplate.exchange(
            PAYPAL_BASE + "/v2/payments/authorizations/" + authorizationId,
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

