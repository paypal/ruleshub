# Save Payment Button (Server-Side)

## Spring Boot Implementation

```java
@RestController
@RequestMapping("/paypal-api/vault")
public class PayPalSavePaymentController {
    
    @Value("${paypal.client.id}")
    private String clientId;
    
    @Value("${paypal.client.secret}")
    private String clientSecret;
    
    @Value("${paypal.base.url:https://api-m.sandbox.paypal.com}")
    private String paypalBaseUrl;
    
    @PostMapping("/setup-tokens/create")
    public ResponseEntity<Map<String, Object>> createSetupTokenForSave(@RequestBody Map<String, Object> request) {
        try {
            String accessToken = getAccessToken();
            String paymentMethod = (String) request.getOrDefault("payment_method", "paypal");
            
            Map<String, Object> paymentSource = new HashMap<>();
            
            if ("paypal".equals(paymentMethod)) {
                Map<String, Object> paypal = new HashMap<>();
                paypal.put("usage_type", "MERCHANT");
                paypal.put("customer_type", "CONSUMER");
                paypal.put("permit_multiple_payment_tokens", true);
                paymentSource.put("paypal", paypal);
                
            } else if ("card".equals(paymentMethod)) {
                Map<String, Object> experienceContext = new HashMap<>();
                experienceContext.put("return_url", request.getOrDefault("return_url", "https://example.com/returnUrl"));
                experienceContext.put("cancel_url", request.getOrDefault("cancel_url", "https://example.com/cancelUrl"));
                
                Map<String, Object> card = new HashMap<>();
                card.put("experience_context", experienceContext);
                card.put("verification_method", "SCA_WHEN_REQUIRED");
                paymentSource.put("card", card);
                
            } else {
                Map<String, Object> error = new HashMap<>();
                error.put("error", "INVALID_PAYMENT_METHOD");
                error.put("message", "Payment method must be paypal or card");
                return ResponseEntity.badRequest().body(error);
            }
            
            Map<String, Object> payload = new HashMap<>();
            payload.put("payment_source", paymentSource);
            
            HttpHeaders headers = new HttpHeaders();
            headers.set("Authorization", "Bearer " + accessToken);
            headers.setContentType(MediaType.APPLICATION_JSON);
            headers.set("PayPal-Request-Id", UUID.randomUUID().toString());
            
            HttpEntity<Map<String, Object>> entity = new HttpEntity<>(payload, headers);
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
            return ResponseEntity.status(500).body(error);
        }
    }
    
    @PostMapping("/payment-tokens/create")
    public ResponseEntity<Map<String, Object>> createPaymentTokenFromSetup(@RequestBody Map<String, Object> request) {
        try {
            String setupToken = (String) request.get("vaultSetupToken");
            
            if (setupToken == null || setupToken.isEmpty()) {
                Map<String, Object> error = new HashMap<>();
                error.put("error", "MISSING_SETUP_TOKEN");
                error.put("message", "vaultSetupToken is required");
                return ResponseEntity.badRequest().body(error);
            }
            
            String accessToken = getAccessToken();
            
            Map<String, Object> token = new HashMap<>();
            token.put("id", setupToken);
            token.put("type", "SETUP_TOKEN");
            
            Map<String, Object> paymentSource = new HashMap<>();
            paymentSource.put("token", token);
            
            Map<String, Object> payload = new HashMap<>();
            payload.put("payment_source", paymentSource);
            
            HttpHeaders headers = new HttpHeaders();
            headers.set("Authorization", "Bearer " + accessToken);
            headers.setContentType(MediaType.APPLICATION_JSON);
            headers.set("PayPal-Request-Id", UUID.randomUUID().toString());
            
            HttpEntity<Map<String, Object>> entity = new HttpEntity<>(payload, headers);
            RestTemplate restTemplate = new RestTemplate();
            
            ResponseEntity<Map> response = restTemplate.postForEntity(
                paypalBaseUrl + "/v3/vault/payment-tokens",
                entity,
                Map.class
            );
            
            Map<String, Object> tokenData = response.getBody();
            Map<String, Object> customer = (Map<String, Object>) tokenData.get("customer");
            
            Map<String, Object> result = new HashMap<>();
            result.put("id", tokenData.get("id"));
            result.put("customerId", customer != null ? customer.get("id") : null);
            result.put("status", "saved");
            
            return ResponseEntity.ok(result);
            
        } catch (Exception e) {
            Map<String, Object> error = new HashMap<>();
            error.put("error", "PAYMENT_TOKEN_FAILED");
            return ResponseEntity.status(500).body(error);
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

