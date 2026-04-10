# Create Order (Server-Side)

## Spring Boot Implementation

```java
@RestController
@RequestMapping("/paypal-api/checkout/orders")
public class PayPalOrderController {
    
    @Value("${paypal.client.id}")
    private String clientId;
    
    @Value("${paypal.client.secret}")
    private String clientSecret;
    
    @Value("${paypal.base.url:https://api-m.sandbox.paypal.com}")
    private String paypalBaseUrl;
    
    @PostMapping("/create")
    public ResponseEntity<Map<String, Object>> createOrder(@RequestBody Map<String, Object> request) {
        try {
            String amount = (String) request.get("amount");
            String currency = (String) request.getOrDefault("currency", "USD");
            
            if (amount == null || Double.parseDouble(amount) <= 0) {
                Map<String, Object> error = new HashMap<>();
                error.put("error", "INVALID_AMOUNT");
                error.put("message", "Invalid or missing amount");
                return ResponseEntity.badRequest().body(error);
            }
            
            String accessToken = getAccessToken();
            
            Map<String, Object> orderPayload = new HashMap<>();
            orderPayload.put("intent", "CAPTURE");
            
            Map<String, Object> amount_obj = new HashMap<>();
            amount_obj.put("currency_code", currency);
            amount_obj.put("value", String.format("%.2f", Double.parseDouble(amount)));
            
            Map<String, Object> purchaseUnit = new HashMap<>();
            purchaseUnit.put("amount", amount_obj);
            
            if (request.containsKey("description")) {
                purchaseUnit.put("description", request.get("description"));
            }
            
            orderPayload.put("purchase_units", Arrays.asList(purchaseUnit));
            
            Map<String, Object> experienceContext = new HashMap<>();
            experienceContext.put("payment_method_preference", "IMMEDIATE_PAYMENT_REQUIRED");
            experienceContext.put("brand_name", "Your Store Name");
            experienceContext.put("locale", "en-US");
            experienceContext.put("landing_page", "LOGIN");
            experienceContext.put("shipping_preference", "NO_SHIPPING");
            experienceContext.put("user_action", "PAY_NOW");
            
            Map<String, Object> paypalSource = new HashMap<>();
            paypalSource.put("experience_context", experienceContext);
            
            Map<String, Object> paymentSource = new HashMap<>();
            paymentSource.put("paypal", paypalSource);
            
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
            
            Map<String, Object> orderData = response.getBody();
            
            Map<String, Object> result = new HashMap<>();
            result.put("id", orderData.get("id"));
            result.put("status", orderData.get("status"));
            result.put("links", orderData.get("links"));
            
            return ResponseEntity.ok(result);
            
        } catch (Exception e) {
            Map<String, Object> error = new HashMap<>();
            error.put("error", "ORDER_CREATION_FAILED");
            error.put("message", "Failed to create order");
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

