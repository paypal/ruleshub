# Venmo Integration (Server-Side)

## Spring Boot Implementation

```java
@RestController
@RequestMapping("/paypal-api/checkout/orders")
public class PayPalVenmoController {
    
    @Value("${paypal.client.id}")
    private String clientId;
    
    @Value("${paypal.client.secret}")
    private String clientSecret;
    
    @Value("${paypal.base.url:https://api-m.sandbox.paypal.com}")
    private String paypalBaseUrl;
    
    @PostMapping("/create-venmo")
    public ResponseEntity<Map<String, Object>> createOrderForVenmo(@RequestBody Map<String, Object> request) {
        try {
            String accessToken = getAccessToken();
            String amount = (String) request.get("amount");
            String currency = (String) request.getOrDefault("currency", "USD");
            
            Map<String, Object> amountObj = new HashMap<>();
            amountObj.put("currency_code", currency);
            amountObj.put("value", String.format("%.2f", Double.parseDouble(amount)));
            
            Map<String, Object> purchaseUnit = new HashMap<>();
            purchaseUnit.put("amount", amountObj);
            
            Map<String, Object> experienceContext = new HashMap<>();
            experienceContext.put("payment_method_preference", "IMMEDIATE_PAYMENT_REQUIRED");
            experienceContext.put("brand_name", request.getOrDefault("brand_name", "Your Store"));
            experienceContext.put("shipping_preference", "NO_SHIPPING");
            experienceContext.put("user_action", "PAY_NOW");
            
            Map<String, Object> venmo = new HashMap<>();
            venmo.put("experience_context", experienceContext);
            
            Map<String, Object> paymentSource = new HashMap<>();
            paymentSource.put("venmo", venmo);
            
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
    
    @PostMapping("/create-with-saved-venmo")
    public ResponseEntity<Map<String, Object>> createOrderWithSavedVenmo(@RequestBody Map<String, Object> request) {
        try {
            String vaultId = (String) request.get("vaultId");
            
            if (vaultId == null || vaultId.isEmpty()) {
                Map<String, Object> error = new HashMap<>();
                error.put("error", "MISSING_VAULT_ID");
                error.put("message", "vaultId is required");
                return ResponseEntity.badRequest().body(error);
            }
            
            String accessToken = getAccessToken();
            String amount = (String) request.get("amount");
            String currency = (String) request.getOrDefault("currency", "USD");
            
            Map<String, Object> amountObj = new HashMap<>();
            amountObj.put("currency_code", currency);
            amountObj.put("value", String.format("%.2f", Double.parseDouble(amount)));
            
            Map<String, Object> purchaseUnit = new HashMap<>();
            purchaseUnit.put("amount", amountObj);
            
            Map<String, Object> venmo = new HashMap<>();
            venmo.put("vault_id", vaultId);
            
            Map<String, Object> paymentSource = new HashMap<>();
            paymentSource.put("venmo", venmo);
            
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
            
            ResponseEntity<Map> orderResponse = restTemplate.postForEntity(
                paypalBaseUrl + "/v2/checkout/orders",
                entity,
                Map.class
            );
            
            Map<String, Object> orderData = orderResponse.getBody();
            
            if ("CREATED".equals(orderData.get("status"))) {
                String orderId = (String) orderData.get("id");
                
                headers.set("PayPal-Request-Id", UUID.randomUUID().toString());
                HttpEntity<Map<String, Object>> captureEntity = new HttpEntity<>(new HashMap<>(), headers);
                
                ResponseEntity<Map> captureResponse = restTemplate.postForEntity(
                    paypalBaseUrl + "/v2/checkout/orders/" + orderId + "/capture",
                    captureEntity,
                    Map.class
                );
                
                return ResponseEntity.ok(captureResponse.getBody());
            }
            
            return ResponseEntity.ok(orderData);
            
        } catch (Exception e) {
            Map<String, Object> error = new HashMap<>();
            error.put("error", "PAYMENT_FAILED");
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

