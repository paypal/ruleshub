# Create Setup Token (Server-Side)

## Spring Boot Implementation

```java
@RestController
@RequestMapping("/paypal-api/vault")
public class PayPalSetupTokenController {
    
    @Value("${paypal.client.id}")
    private String clientId;
    
    @Value("${paypal.client.secret}")
    private String clientSecret;
    
    @Value("${paypal.base.url:https://api-m.sandbox.paypal.com}")
    private String paypalBaseUrl;
    
    @PostMapping("/setup-tokens")
    public ResponseEntity<Map<String, Object>> createSetupToken(@RequestBody Map<String, Object> request) {
        try {
            String accessToken = getAccessToken();
            String paymentMethod = (String) request.getOrDefault("payment_method", "paypal");
            
            Map<String, Object> setupTokenPayload = new HashMap<>();
            Map<String, Object> paymentSource = new HashMap<>();
            
            if ("paypal".equals(paymentMethod)) {
                Map<String, Object> paypalSource = new HashMap<>();
                paypalSource.put("usage_type", request.getOrDefault("usage_type", "MERCHANT"));
                paypalSource.put("customer_type", request.getOrDefault("customer_type", "CONSUMER"));
                paypalSource.put("permit_multiple_payment_tokens", request.getOrDefault("permit_multiple_payment_tokens", true));
                paymentSource.put("paypal", paypalSource);
                
            } else if ("card".equals(paymentMethod)) {
                Map<String, Object> cardSource = new HashMap<>();
                Map<String, Object> experienceContext = new HashMap<>();
                experienceContext.put("return_url", request.getOrDefault("return_url", "https://example.com/returnUrl"));
                experienceContext.put("cancel_url", request.getOrDefault("cancel_url", "https://example.com/cancelUrl"));
                cardSource.put("experience_context", experienceContext);
                cardSource.put("verification_method", request.getOrDefault("verification_method", "SCA_WHEN_REQUIRED"));
                paymentSource.put("card", cardSource);
            }
            
            setupTokenPayload.put("payment_source", paymentSource);
            
            HttpHeaders headers = new HttpHeaders();
            headers.set("Authorization", "Bearer " + accessToken);
            headers.setContentType(MediaType.APPLICATION_JSON);
            headers.set("PayPal-Request-Id", UUID.randomUUID().toString());
            
            HttpEntity<Map<String, Object>> entity = new HttpEntity<>(setupTokenPayload, headers);
            RestTemplate restTemplate = new RestTemplate();
            
            ResponseEntity<Map> response = restTemplate.postForEntity(
                paypalBaseUrl + "/v3/vault/setup-tokens",
                entity,
                Map.class
            );
            
            Map<String, Object> setupData = response.getBody();
            
            Map<String, Object> result = new HashMap<>();
            result.put("id", setupData.get("id"));
            result.put("status", setupData.get("status"));
            
            return ResponseEntity.ok(result);
            
        } catch (Exception e) {
            Map<String, Object> error = new HashMap<>();
            error.put("error", "SETUP_TOKEN_FAILED");
            error.put("message", "Failed to create setup token");
            return ResponseEntity.status(500).body(error);
        }
    }
    
    @GetMapping("/setup-tokens/{tokenId}")
    public ResponseEntity<Map<String, Object>> getSetupToken(@PathVariable String tokenId) {
        try {
            String accessToken = getAccessToken();
            
            HttpHeaders headers = new HttpHeaders();
            headers.set("Authorization", "Bearer " + accessToken);
            headers.setContentType(MediaType.APPLICATION_JSON);
            
            HttpEntity<String> entity = new HttpEntity<>(headers);
            RestTemplate restTemplate = new RestTemplate();
            
            ResponseEntity<Map> response = restTemplate.exchange(
                paypalBaseUrl + "/v3/vault/setup-tokens/" + tokenId,
                HttpMethod.GET,
                entity,
                Map.class
            );
            
            return ResponseEntity.ok(response.getBody());
            
        } catch (Exception e) {
            Map<String, Object> error = new HashMap<>();
            error.put("error", "SETUP_TOKEN_NOT_FOUND");
            return ResponseEntity.status(404).body(error);
        }
    }
    
    private String getAccessToken() {
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

