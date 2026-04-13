# Fastlane Integration (Server-Side)

## Spring Boot Implementation

```java
@RestController
@RequestMapping("/paypal-api/checkout/orders")
@CrossOrigin(
    origins = "*",
    allowedHeaders = {"Content-Type", "Authorization", "PayPal-Request-Id"},
    methods = {RequestMethod.GET, RequestMethod.POST, RequestMethod.PUT, RequestMethod.DELETE, RequestMethod.OPTIONS}
)
public class PayPalFastlaneController {
    
    @Value("${paypal.client.id}")
    private String clientId;
    
    @Value("${paypal.client.secret}")
    private String clientSecret;
    
    @Value("${paypal.base.url:https://api-m.sandbox.paypal.com}")
    private String paypalBaseUrl;
    
    @PostMapping("/create")
    public ResponseEntity<Map<String, Object>> createOrderFastlane(
            @RequestBody Map<String, Object> request,
            @RequestHeader(value = "PayPal-Request-Id", required = false) String paypalRequestId) {
        try {
            String accessToken = getAccessToken();
            
            if (paypalRequestId == null || paypalRequestId.isEmpty()) {
                paypalRequestId = UUID.randomUUID().toString();
            }
            
            HttpHeaders headers = new HttpHeaders();
            headers.set("Authorization", "Bearer " + accessToken);
            headers.setContentType(MediaType.APPLICATION_JSON);
            headers.set("PayPal-Request-Id", paypalRequestId);
            
            HttpEntity<Map<String, Object>> entity = new HttpEntity<>(request, headers);
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
    
    @PostMapping("/{orderId}/capture")
    public ResponseEntity<Map<String, Object>> captureOrderFastlane(@PathVariable String orderId) {
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
            
            return ResponseEntity.status(response.getStatusCode()).body(response.getBody());
            
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

