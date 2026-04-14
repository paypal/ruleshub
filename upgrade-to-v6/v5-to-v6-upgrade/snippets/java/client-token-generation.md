# Client Token Generation (Server-Side)

## Spring Boot Implementation

```java
@RestController
@RequestMapping("/paypal-api")
public class PayPalAuthController {
    
    @Value("${paypal.client.id}")
    private String clientId;
    
    @Value("${paypal.client.secret}")
    private String clientSecret;
    
    @Value("${paypal.base.url:https://api-m.sandbox.paypal.com}")
    private String paypalBaseUrl;
    
    private String cachedToken = null;
    private LocalDateTime tokenExpiration = null;
    
    @GetMapping("/auth/browser-safe-client-token")
    public ResponseEntity<Map<String, Object>> getClientToken() {
        try {
            if (cachedToken != null && tokenExpiration != null && LocalDateTime.now().isBefore(tokenExpiration)) {
                long expiresIn = Duration.between(LocalDateTime.now(), tokenExpiration).getSeconds();
                Map<String, Object> response = new HashMap<>();
                response.put("accessToken", cachedToken);
                response.put("expiresIn", expiresIn);
                return ResponseEntity.ok(response);
            }
            
            String auth = Base64.getEncoder().encodeToString((clientId + ":" + clientSecret).getBytes());
            
            HttpHeaders headers = new HttpHeaders();
            headers.set("Authorization", "Basic " + auth);
            headers.setContentType(MediaType.APPLICATION_FORM_URLENCODED);
            
            String body = "grant_type=client_credentials&response_type=client_token&intent=sdk_init";
            
            HttpEntity<String> entity = new HttpEntity<>(body, headers);
            RestTemplate restTemplate = new RestTemplate();
            
            ResponseEntity<Map> tokenResponse = restTemplate.postForEntity(
                paypalBaseUrl + "/v1/oauth2/token",
                entity,
                Map.class
            );
            
            Map<String, Object> tokenData = tokenResponse.getBody();
            String accessToken = (String) tokenData.get("access_token");
            Integer expiresIn = (Integer) tokenData.get("expires_in");
            
            cachedToken = accessToken;
            tokenExpiration = LocalDateTime.now().plusSeconds(expiresIn - 120);
            
            Map<String, Object> response = new HashMap<>();
            response.put("accessToken", accessToken);
            response.put("expiresIn", expiresIn);
            
            return ResponseEntity.ok(response);
            
        } catch (Exception e) {
            Map<String, Object> error = new HashMap<>();
            error.put("error", "TOKEN_GENERATION_FAILED");
            error.put("message", "Failed to generate client token");
            return ResponseEntity.status(500).body(error);
        }
    }
    
    public String getAccessToken() {
        String auth = Base64.getEncoder().encodeToString((clientId + ":" + clientSecret).getBytes());
        
        HttpHeaders headers = new HttpHeaders();
        headers.set("Authorization", "Basic " + auth);
        headers.setContentType(MediaType.APPLICATION_FORM_URLENCODED);
        
        HttpEntity<String> entity = new HttpEntity<>("grant_type=client_credentials", headers);
        RestTemplate restTemplate = new RestTemplate();
        
        ResponseEntity<Map> response = restTemplate.postForEntity(
            paypalBaseUrl + "/v1/oauth2/token",
            entity,
            Map.class
        );
        
        return (String) response.getBody().get("access_token");
    }
}
```

## Application Properties

```properties
paypal.client.id=your_client_id_here
paypal.client.secret=your_client_secret_here
paypal.base.url=https://api-m.sandbox.paypal.com
server.port=3000
```

