# Card Fields Integration (Server-Side)

## Spring Boot Implementation

```java
@RestController
@RequestMapping("/paypal-api/checkout/orders")
public class PayPalCardFieldsController {
    
    @Value("${paypal.client.id}")
    private String clientId;
    
    @Value("${paypal.client.secret}")
    private String clientSecret;
    
    @Value("${paypal.base.url:https://api-m.sandbox.paypal.com}")
    private String paypalBaseUrl;
    
    @PostMapping("/create-card-fields")
    public ResponseEntity<Map<String, Object>> createOrderForCardFields(@RequestBody Map<String, Object> request) {
        try {
            String accessToken = getAccessToken();
            String amount = (String) request.get("amount");
            String currency = (String) request.getOrDefault("currency", "USD");
            String verificationMethod = (String) request.getOrDefault("verification_method", "SCA_WHEN_REQUIRED");
            
            Map<String, Object> amountObj = new HashMap<>();
            amountObj.put("currency_code", currency);
            amountObj.put("value", String.format("%.2f", Double.parseDouble(amount)));
            
            Map<String, Object> purchaseUnit = new HashMap<>();
            purchaseUnit.put("amount", amountObj);
            
            Map<String, Object> verification = new HashMap<>();
            verification.put("method", verificationMethod);
            
            Map<String, Object> experienceContext = new HashMap<>();
            experienceContext.put("return_url", request.getOrDefault("return_url", "https://example.com/returnUrl"));
            experienceContext.put("cancel_url", request.getOrDefault("cancel_url", "https://example.com/cancelUrl"));
            
            Map<String, Object> attributes = new HashMap<>();
            attributes.put("verification", verification);
            
            Map<String, Object> card = new HashMap<>();
            card.put("attributes", attributes);
            card.put("experience_context", experienceContext);
            
            Map<String, Object> paymentSource = new HashMap<>();
            paymentSource.put("card", card);
            
            Map<String, Object> orderPayload = new HashMap<>();
            orderPayload.put("intent", "CAPTURE");
            orderPayload.put("purchase_units", Arrays.asList(purchaseUnit));
            orderPayload.put("payment_source", paymentSource);
            
            HttpHeaders headers = new HttpHeaders();
            headers.set("Authorization", "Bearer " + accessToken);
            headers.setContentType(MediaType.APPLICATION_JSON);
            headers.set("PayPal-Request-Id", UUID.randomUUID().toString());
            
            HttpEntity<Map<String, Object>> entity = new HttpEntity<>(orderPayload, headers);
            RestTemplate restTemplate = new RestTemplate();
            
            ResponseEntity<Map> response = restTemplate.postForEntity(
                paypalBaseUrl + "/v2/checkout/orders",
                entity,
                Map.class
            );
            
            return ResponseEntity.status(response.getStatusCode()).body(response.getBody());
            
        } catch (Exception e) {
            Map<String, Object> error = new HashMap<>();
            error.put("error", "ORDER_CREATION_FAILED");
            return ResponseEntity.status(500).body(error);
        }
    }
    
    @PostMapping("/confirm-payment-source")
    public ResponseEntity<Map<String, Object>> confirmPaymentSource(@RequestBody Map<String, Object> request) {
        try {
            String orderId = (String) request.get("orderId");
            
            if (orderId == null || orderId.isEmpty()) {
                Map<String, Object> error = new HashMap<>();
                error.put("error", "MISSING_ORDER_ID");
                error.put("message", "orderId is required");
                return ResponseEntity.badRequest().body(error);
            }
            
            String accessToken = getAccessToken();
            
            Map<String, Object> card = new HashMap<>();
            card.put("single_use_token", request.get("single_use_token"));
            
            Map<String, Object> paymentSource = new HashMap<>();
            paymentSource.put("card", card);
            
            Map<String, Object> payload = new HashMap<>();
            payload.put("payment_source", paymentSource);
            
            HttpHeaders headers = new HttpHeaders();
            headers.set("Authorization", "Bearer " + accessToken);
            headers.setContentType(MediaType.APPLICATION_JSON);
            headers.set("PayPal-Request-Id", UUID.randomUUID().toString());
            
            HttpEntity<Map<String, Object>> entity = new HttpEntity<>(payload, headers);
            RestTemplate restTemplate = new RestTemplate();
            
            ResponseEntity<Map> response = restTemplate.postForEntity(
                paypalBaseUrl + "/v2/checkout/orders/" + orderId + "/confirm-payment-source",
                entity,
                Map.class
            );
            
            return ResponseEntity.status(response.getStatusCode()).body(response.getBody());
            
        } catch (Exception e) {
            Map<String, Object> error = new HashMap<>();
            error.put("error", "CONFIRMATION_FAILED");
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

