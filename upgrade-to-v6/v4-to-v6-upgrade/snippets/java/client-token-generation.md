#### Generate Client Token for v6 SDK

```java
import org.springframework.web.bind.annotation.*;
import org.springframework.http.*;
import org.springframework.web.client.RestTemplate;
import java.util.*;
import java.nio.charset.StandardCharsets;

@RestController
@RequestMapping("/paypal-api")
public class PayPalTokenController {
    
    private final String PAYPAL_BASE = System.getenv().getOrDefault("PAYPAL_BASE", "https://api-m.sandbox.paypal.com");
    private final String CLIENT_ID = System.getenv("PAYPAL_CLIENT_ID");
    private final String CLIENT_SECRET = System.getenv("PAYPAL_CLIENT_SECRET");
    private final RestTemplate restTemplate = new RestTemplate();
    
    @GetMapping("/auth/browser-safe-client-token")
    public ResponseEntity<?> getBrowserSafeClientToken() {
        try {
            String auth = Base64.getEncoder().encodeToString(
                (CLIENT_ID + ":" + CLIENT_SECRET).getBytes(StandardCharsets.UTF_8)
            );
            
            HttpHeaders headers = new HttpHeaders();
            headers.set("Authorization", "Basic " + auth);
            headers.setContentType(MediaType.APPLICATION_FORM_URLENCODED);
            
            String body = "grant_type=client_credentials&response_type=client_token&intent=sdk_init";
            HttpEntity<String> request = new HttpEntity<>(body, headers);
            
            ResponseEntity<Map> response = restTemplate.postForEntity(
                PAYPAL_BASE + "/v1/oauth2/token",
                request,
                Map.class
            );
            
            Map<String, Object> result = new HashMap<>();
            result.put("accessToken", response.getBody().get("access_token"));
            result.put("expiresIn", response.getBody().get("expires_in"));
            
            return ResponseEntity.ok(result);
            
        } catch (Exception e) {
            Map<String, String> error = new HashMap<>();
            error.put("error", "TOKEN_GENERATION_FAILED");
            return ResponseEntity.status(500).body(error);
        }
    }
    
    public String getAccessToken() {
        String auth = Base64.getEncoder().encodeToString(
            (CLIENT_ID + ":" + CLIENT_SECRET).getBytes(StandardCharsets.UTF_8)
        );
        
        HttpHeaders headers = new HttpHeaders();
        headers.set("Authorization", "Basic " + auth);
        headers.setContentType(MediaType.APPLICATION_FORM_URLENCODED);
        
        HttpEntity<String> request = new HttpEntity<>("grant_type=client_credentials", headers);
        
        ResponseEntity<Map> response = restTemplate.postForEntity(
            PAYPAL_BASE + "/v1/oauth2/token",
            request,
            Map.class
        );
        
        return (String) response.getBody().get("access_token");
    }
}
```

