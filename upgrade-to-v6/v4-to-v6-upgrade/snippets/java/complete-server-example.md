#### Complete Spring Boot Application

```java
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.context.annotation.Bean;
import org.springframework.web.client.RestTemplate;

@SpringBootApplication
public class PayPalV6Application {
    
    public static void main(String[] args) {
        SpringApplication.run(PayPalV6Application.class, args);
    }
    
    @Bean
    public RestTemplate restTemplate() {
        return new RestTemplate();
    }
}
```

#### Complete Controller

```java
import org.springframework.web.bind.annotation.*;
import org.springframework.http.*;
import org.springframework.web.client.RestTemplate;
import java.util.*;
import java.nio.charset.StandardCharsets;

@RestController
@RequestMapping("/paypal-api")
@CrossOrigin(origins = "*", allowedHeaders = {"Content-Type", "Authorization", "PayPal-Request-Id"})
public class PayPalController {
    
    private final String PAYPAL_BASE = System.getenv().getOrDefault("PAYPAL_BASE", "https://api-m.sandbox.paypal.com");
    private final String CLIENT_ID = System.getenv("PAYPAL_CLIENT_ID");
    private final String CLIENT_SECRET = System.getenv("PAYPAL_CLIENT_SECRET");
    private final RestTemplate restTemplate;
    
    public PayPalController(RestTemplate restTemplate) {
        this.restTemplate = restTemplate;
    }
    
    private String getAccessToken() {
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
            
            return ResponseEntity.ok(result);
            
        } catch (Exception e) {
            Map<String, String> error = new HashMap<>();
            error.put("error", "TOKEN_GENERATION_FAILED");
            return ResponseEntity.status(500).body(error);
        }
    }
    
    @PostMapping("/checkout/orders/create")
    public ResponseEntity<?> createOrder(
            @RequestBody Map<String, Object> requestBody,
            @RequestHeader(value = "PayPal-Request-Id", required = false) String paypalRequestId) {
        try {
            String accessToken = getAccessToken();
            
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
    
    @PostMapping("/checkout/orders/{orderId}/capture")
    public ResponseEntity<?> captureOrder(@PathVariable String orderId) {
        try {
            String accessToken = getAccessToken();
            
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
            
            return ResponseEntity.ok(response.getBody());
            
        } catch (Exception e) {
            Map<String, String> error = new HashMap<>();
            error.put("error", "CAPTURE_FAILED");
            return ResponseEntity.status(500).body(error);
        }
    }
}
```

#### Application Properties (application.properties)

```properties
server.port=8080
spring.application.name=paypal-v6-service
```

#### Maven Dependencies (pom.xml)

```xml
<dependencies>
    <dependency>
        <groupId>org.springframework.boot</groupId>
        <artifactId>spring-boot-starter-web</artifactId>
    </dependency>
    <dependency>
        <groupId>com.fasterxml.jackson.core</groupId>
        <artifactId>jackson-databind</artifactId>
    </dependency>
    <dependency>
        <groupId>org.slf4j</groupId>
        <artifactId>slf4j-api</artifactId>
    </dependency>
</dependencies>
```

#### Environment Variables

```bash
export PAYPAL_CLIENT_ID=your_client_id_here
export PAYPAL_CLIENT_SECRET=your_client_secret_here
export PAYPAL_BASE=https://api-m.sandbox.paypal.com
```

