#### Void Authorization

```java
import org.springframework.web.bind.annotation.*;
import org.springframework.http.*;
import org.springframework.web.client.RestTemplate;
import java.util.*;

@PostMapping("/payments/authorizations/{authorizationId}/void")
public ResponseEntity<?> voidAuthorization(@PathVariable String authorizationId) {
    try {
        String accessToken = tokenController.getAccessToken();
        
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        headers.set("Authorization", "Bearer " + accessToken);
        headers.set("PayPal-Request-Id", UUID.randomUUID().toString());
        
        HttpEntity<Map<String, Object>> request = new HttpEntity<>(new HashMap<>(), headers);
        
        restTemplate.postForEntity(
            PAYPAL_BASE + "/v2/payments/authorizations/" + authorizationId + "/void",
            request,
            Void.class
        );
        
        Map<String, Object> result = new HashMap<>();
        result.put("success", true);
        result.put("authorizationId", authorizationId);
        result.put("status", "VOIDED");
        
        return ResponseEntity.ok(result);
        
    } catch (Exception e) {
        Map<String, String> error = new HashMap<>();
        error.put("error", "VOID_FAILED");
        return ResponseEntity.status(500).body(error);
    }
}
```

