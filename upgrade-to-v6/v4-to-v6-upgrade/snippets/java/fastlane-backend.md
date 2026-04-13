#### Fastlane - Create Order with Single-Use Token

```java
import org.springframework.web.bind.annotation.*;
import org.springframework.http.*;
import org.springframework.web.client.RestTemplate;
import java.util.*;

@RestController
@RequestMapping("/paypal-api/checkout/orders")
@CrossOrigin(origins = "*", allowedHeaders = {"Content-Type", "Authorization", "PayPal-Request-Id"})
public class FastlaneOrderController {
    
    private final String PAYPAL_BASE = System.getenv().getOrDefault("PAYPAL_BASE", "https://api-m.sandbox.paypal.com");
    private final RestTemplate restTemplate = new RestTemplate();
    private final PayPalTokenController tokenController;
    
    public FastlaneOrderController(PayPalTokenController tokenController) {
        this.tokenController = tokenController;
    }
    
    @PostMapping("/create")
    public ResponseEntity<?> createFastlaneOrder(
            @RequestBody Map<String, Object> requestBody,
            @RequestHeader(value = "PayPal-Request-Id", required = false) String paypalRequestId) {
        try {
            String accessToken = tokenController.getAccessToken();
            
            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);
            headers.set("Authorization", "Bearer " + accessToken);
            headers.set("PayPal-Request-Id", 
                paypalRequestId != null ? paypalRequestId : UUID.randomUUID().toString());
            
            HttpEntity<Map<String, Object>> request = new HttpEntity<>(requestBody, headers);
            
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
}
```

#### CORS Configuration

```java
import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.*;

@Configuration
public class CorsConfig implements WebMvcConfigurer {
    
    @Override
    public void addCorsMappings(CorsRegistry registry) {
        registry.addMapping("/paypal-api/**")
                .allowedOrigins("*")
                .allowedMethods("GET", "POST", "PUT", "DELETE", "OPTIONS")
                .allowedHeaders("Content-Type", "Authorization", "PayPal-Request-Id");
    }
}
```

