#### Full Refund

```java
import org.springframework.web.bind.annotation.*;
import org.springframework.http.*;
import org.springframework.web.client.RestTemplate;
import java.util.*;

@PostMapping("/payments/captures/{captureId}/refund")
public ResponseEntity<?> refundPayment(@PathVariable String captureId) {
    try {
        String accessToken = tokenController.getAccessToken();
        
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        headers.set("Authorization", "Bearer " + accessToken);
        headers.set("PayPal-Request-Id", UUID.randomUUID().toString());
        
        HttpEntity<Map<String, Object>> request = new HttpEntity<>(new HashMap<>(), headers);
        
        ResponseEntity<Map> response = restTemplate.postForEntity(
            PAYPAL_BASE + "/v2/payments/captures/" + captureId + "/refund",
            request,
            Map.class
        );
        
        return ResponseEntity.ok(response.getBody());
        
    } catch (Exception e) {
        Map<String, String> error = new HashMap<>();
        error.put("error", "REFUND_FAILED");
        return ResponseEntity.status(500).body(error);
    }
}
```

#### Partial Refund

```java
@PostMapping("/payments/captures/{captureId}/refund-partial")
public ResponseEntity<?> refundPaymentPartial(
        @PathVariable String captureId,
        @RequestBody Map<String, Object> requestBody) {
    try {
        String accessToken = tokenController.getAccessToken();
        
        Map<String, Object> amount = new HashMap<>();
        amount.put("value", requestBody.get("amount"));
        amount.put("currency_code", requestBody.getOrDefault("currency", "USD"));
        
        Map<String, Object> refundPayload = new HashMap<>();
        refundPayload.put("amount", amount);
        
        if (requestBody.containsKey("note")) {
            refundPayload.put("note_to_payer", requestBody.get("note"));
        }
        
        if (requestBody.containsKey("invoiceId")) {
            refundPayload.put("invoice_id", requestBody.get("invoiceId"));
        }
        
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        headers.set("Authorization", "Bearer " + accessToken);
        headers.set("PayPal-Request-Id", UUID.randomUUID().toString());
        
        HttpEntity<Map<String, Object>> request = new HttpEntity<>(refundPayload, headers);
        
        ResponseEntity<Map> response = restTemplate.postForEntity(
            PAYPAL_BASE + "/v2/payments/captures/" + captureId + "/refund",
            request,
            Map.class
        );
        
        Map<String, Object> refundData = response.getBody();
        
        Map<String, Object> result = new HashMap<>();
        result.put("refundId", refundData.get("id"));
        result.put("status", refundData.get("status"));
        result.put("amount", refundData.get("amount"));
        result.put("details", refundData);
        
        return ResponseEntity.ok(result);
        
    } catch (Exception e) {
        Map<String, String> error = new HashMap<>();
        error.put("error", "REFUND_FAILED");
        return ResponseEntity.status(500).body(error);
    }
}
```

#### Get Refund Details

```java
@GetMapping("/payments/refunds/{refundId}")
public ResponseEntity<?> getRefundDetails(@PathVariable String refundId) {
    try {
        String accessToken = tokenController.getAccessToken();
        
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        headers.set("Authorization", "Bearer " + accessToken);
        
        HttpEntity<?> request = new HttpEntity<>(headers);
        
        ResponseEntity<Map> response = restTemplate.exchange(
            PAYPAL_BASE + "/v2/payments/refunds/" + refundId,
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

#### Get Order Details for Refund

```java
@GetMapping("/checkout/orders/{orderId}/details")
public ResponseEntity<?> getOrderDetailsForRefund(@PathVariable String orderId) {
    try {
        String accessToken = tokenController.getAccessToken();
        
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        headers.set("Authorization", "Bearer " + accessToken);
        
        HttpEntity<?> request = new HttpEntity<>(headers);
        
        ResponseEntity<Map> response = restTemplate.exchange(
            PAYPAL_BASE + "/v2/checkout/orders/" + orderId,
            HttpMethod.GET,
            request,
            Map.class
        );
        
        Map<String, Object> orderData = response.getBody();
        List<Map<String, Object>> purchaseUnits = (List<Map<String, Object>>) orderData.get("purchase_units");
        Map<String, Object> payments = (Map<String, Object>) purchaseUnits.get(0).get("payments");
        List<Map<String, Object>> captures = (List<Map<String, Object>>) payments.getOrDefault("captures", new ArrayList<>());
        String captureId = captures.isEmpty() ? null : (String) captures.get(0).get("id");
        
        Map<String, Object> result = new HashMap<>();
        result.put("orderId", orderId);
        result.put("captureId", captureId);
        result.put("status", orderData.get("status"));
        result.put("details", orderData);
        
        return ResponseEntity.ok(result);
        
    } catch (Exception e) {
        Map<String, String> error = new HashMap<>();
        error.put("error", "FETCH_FAILED");
        return ResponseEntity.status(500).body(error);
    }
}
```

