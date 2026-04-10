# 3D Secure Integration (Server-Side)

## Spring Boot Implementation

```java
@RestController
@RequestMapping("/paypal-api/checkout/orders")
public class PayPal3DSController {
    
    @Value("${paypal.client.id}")
    private String clientId;
    
    @Value("${paypal.client.secret}")
    private String clientSecret;
    
    @Value("${paypal.base.url:https://api-m.sandbox.paypal.com}")
    private String paypalBaseUrl;
    
    @PostMapping("/create-3ds")
    public ResponseEntity<Map<String, Object>> createOrderWith3DS(@RequestBody Map<String, Object> request) {
        try {
            String accessToken = getAccessToken();
            String amount = (String) request.get("amount");
            String currency = (String) request.getOrDefault("currency", "USD");
            String scaMethod = (String) request.getOrDefault("scaMethod", "SCA_ALWAYS");
            
            Map<String, Object> amountObj = new HashMap<>();
            amountObj.put("currency_code", currency);
            amountObj.put("value", String.format("%.2f", Double.parseDouble(amount)));
            
            Map<String, Object> purchaseUnit = new HashMap<>();
            purchaseUnit.put("amount", amountObj);
            
            Map<String, Object> verification = new HashMap<>();
            verification.put("method", scaMethod);
            
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
            
            return ResponseEntity.ok(response.getBody());
            
        } catch (Exception e) {
            Map<String, Object> error = new HashMap<>();
            error.put("error", "ORDER_CREATION_FAILED");
            return ResponseEntity.status(500).body(error);
        }
    }
    
    @PostMapping("/{orderId}/capture-3ds")
    public ResponseEntity<Map<String, Object>> captureOrderWith3DSLogging(@PathVariable String orderId) {
        try {
            String accessToken = getAccessToken();
            
            HttpHeaders headers = new HttpHeaders();
            headers.set("Authorization", "Bearer " + accessToken);
            headers.setContentType(MediaType.APPLICATION_JSON);
            headers.set("PayPal-Request-Id", UUID.randomUUID().toString());
            
            HttpEntity<Map<String, Object>> entity = new HttpEntity<>(new HashMap<>(), headers);
            RestTemplate restTemplate = new RestTemplate();
            
            ResponseEntity<Map> response = restTemplate.postForEntity(
                paypalBaseUrl + "/v2/checkout/orders/" + orderId + "/capture",
                entity,
                Map.class
            );
            
            Map<String, Object> captureData = response.getBody();
            
            Map<String, Object> paymentSource = (Map<String, Object>) captureData.get("payment_source");
            if (paymentSource != null) {
                Map<String, Object> card = (Map<String, Object>) paymentSource.get("card");
                if (card != null) {
                    Map<String, Object> authResult = (Map<String, Object>) card.get("authentication_result");
                    if (authResult != null) {
                        Map<String, Object> threeDS = (Map<String, Object>) authResult.get("three_d_secure");
                        
                        System.out.println("3DS Authentication Result:");
                        System.out.println("  Order ID: " + captureData.get("id"));
                        System.out.println("  Liability Shift: " + authResult.get("liability_shift"));
                        System.out.println("  Auth Status: " + (threeDS != null ? threeDS.get("authentication_status") : null));
                        System.out.println("  Enrollment Status: " + (threeDS != null ? threeDS.get("enrollment_status") : null));
                    }
                }
            }
            
            return ResponseEntity.ok(captureData);
            
        } catch (Exception e) {
            Map<String, Object> error = new HashMap<>();
            error.put("error", "CAPTURE_FAILED");
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

