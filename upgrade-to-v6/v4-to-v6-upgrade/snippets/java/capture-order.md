#### Capture Order

```java
import org.springframework.web.bind.annotation.*;
import org.springframework.http.*;
import org.springframework.web.client.RestTemplate;
import java.util.*;

@PostMapping("/{orderId}/capture")
public ResponseEntity<?> captureOrder(@PathVariable String orderId) {
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
        
        return ResponseEntity.status(response.getStatusCode()).body(response.getBody());
        
    } catch (Exception e) {
        Map<String, String> error = new HashMap<>();
        error.put("error", "CAPTURE_FAILED");
        return ResponseEntity.status(500).body(error);
    }
}
```

