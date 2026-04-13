# Create Payment Token (Server-Side)

## Spring Boot Implementation

```java
@RestController
@RequestMapping("/paypal-api/vault")
public class PayPalPaymentTokenController {
    
    @Value("${paypal.client.id}")
    private String clientId;
    
    @Value("${paypal.client.secret}")
    private String clientSecret;
    
    @Value("${paypal.base.url:https://api-m.sandbox.paypal.com}")
    private String paypalBaseUrl;
    
    @PostMapping("/payment-tokens")
    public ResponseEntity<Map<String, Object>> createPaymentToken(@RequestBody Map<String, Object> request) {
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
            error.put("message", "Failed to create payment token");
            return ResponseEntity.status(500).body(error);
        }
    }
    
    @GetMapping("/payment-tokens")
    public ResponseEntity<Map<String, Object>> listPaymentTokens(@RequestParam String customer_id) {
        try {
            if (customer_id == null || customer_id.isEmpty()) {
                Map<String, Object> error = new HashMap<>();
                error.put("error", "MISSING_CUSTOMER_ID");
                error.put("message", "customer_id query parameter is required");
                return ResponseEntity.badRequest().body(error);
            }
            
            String accessToken = getAccessToken();
            
            HttpHeaders headers = new HttpHeaders();
            headers.set("Authorization", "Bearer " + accessToken);
            headers.setContentType(MediaType.APPLICATION_JSON);
            
            HttpEntity<String> entity = new HttpEntity<>(headers);
            RestTemplate restTemplate = new RestTemplate();
            
            String url = paypalBaseUrl + "/v3/vault/payment-tokens?customer_id=" + customer_id;
            
            ResponseEntity<Map> response = restTemplate.exchange(
                url,
                HttpMethod.GET,
                entity,
                Map.class
            );
            
            Map<String, Object> tokensData = response.getBody();
            List<Map<String, Object>> paymentTokens = (List<Map<String, Object>>) tokensData.get("payment_tokens");
            
            Map<String, Object> result = new HashMap<>();
            result.put("payment_tokens", paymentTokens != null ? paymentTokens : new ArrayList<>());
            result.put("total_items", paymentTokens != null ? paymentTokens.size() : 0);
            
            return ResponseEntity.ok(result);
            
        } catch (Exception e) {
            Map<String, Object> error = new HashMap<>();
            error.put("error", "FETCH_FAILED");
            return ResponseEntity.status(500).body(error);
        }
    }
    
    @GetMapping("/payment-tokens/{tokenId}")
    public ResponseEntity<Map<String, Object>> getPaymentToken(@PathVariable String tokenId) {
        try {
            String accessToken = getAccessToken();
            
            HttpHeaders headers = new HttpHeaders();
            headers.set("Authorization", "Bearer " + accessToken);
            headers.setContentType(MediaType.APPLICATION_JSON);
            
            HttpEntity<String> entity = new HttpEntity<>(headers);
            RestTemplate restTemplate = new RestTemplate();
            
            ResponseEntity<Map> response = restTemplate.exchange(
                paypalBaseUrl + "/v3/vault/payment-tokens/" + tokenId,
                HttpMethod.GET,
                entity,
                Map.class
            );
            
            return ResponseEntity.ok(response.getBody());
            
        } catch (Exception e) {
            Map<String, Object> error = new HashMap<>();
            error.put("error", "TOKEN_NOT_FOUND");
            return ResponseEntity.status(404).body(error);
        }
    }
    
    @DeleteMapping("/payment-tokens/{tokenId}")
    public ResponseEntity<Map<String, Object>> deletePaymentToken(@PathVariable String tokenId) {
        try {
            String accessToken = getAccessToken();
            
            HttpHeaders headers = new HttpHeaders();
            headers.set("Authorization", "Bearer " + accessToken);
            headers.setContentType(MediaType.APPLICATION_JSON);
            
            HttpEntity<String> entity = new HttpEntity<>(headers);
            RestTemplate restTemplate = new RestTemplate();
            
            restTemplate.exchange(
                paypalBaseUrl + "/v3/vault/payment-tokens/" + tokenId,
                HttpMethod.DELETE,
                entity,
                Void.class
            );
            
            Map<String, Object> result = new HashMap<>();
            result.put("success", true);
            result.put("message", "Payment token deleted successfully");
            
            return ResponseEntity.ok(result);
            
        } catch (Exception e) {
            Map<String, Object> error = new HashMap<>();
            error.put("error", "DELETE_FAILED");
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

