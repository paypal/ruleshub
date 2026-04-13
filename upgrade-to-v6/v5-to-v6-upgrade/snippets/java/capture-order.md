# Capture Order (Server-Side)

## Spring Boot Implementation

```java
@RestController
@RequestMapping("/paypal-api/checkout/orders")
public class PayPalCaptureController {
    
    @Value("${paypal.client.id}")
    private String clientId;
    
    @Value("${paypal.client.secret}")
    private String clientSecret;
    
    @Value("${paypal.base.url:https://api-m.sandbox.paypal.com}")
    private String paypalBaseUrl;
    
    @PostMapping("/{orderId}/capture")
    public ResponseEntity<Map<String, Object>> captureOrder(@PathVariable String orderId) {
        try {
            if (orderId == null || orderId.isEmpty()) {
                Map<String, Object> error = new HashMap<>();
                error.put("error", "INVALID_ORDER_ID");
                error.put("message", "Order ID is required");
                return ResponseEntity.badRequest().body(error);
            }
            
            String accessToken = getAccessToken();
            
            HttpHeaders headers = new HttpHeaders();
            headers.set("Authorization", "Bearer " + accessToken);
            headers.setContentType(MediaType.APPLICATION_JSON);
            
            HttpEntity<String> getEntity = new HttpEntity<>(headers);
            RestTemplate restTemplate = new RestTemplate();
            
            ResponseEntity<Map> orderResponse = restTemplate.exchange(
                paypalBaseUrl + "/v2/checkout/orders/" + orderId,
                HttpMethod.GET,
                getEntity,
                Map.class
            );
            
            Map<String, Object> orderData = orderResponse.getBody();
            String status = (String) orderData.get("status");
            
            if (!"APPROVED".equals(status)) {
                Map<String, Object> error = new HashMap<>();
                error.put("error", "ORDER_NOT_APPROVED");
                error.put("message", "Order status is " + status + ", not APPROVED");
                error.put("orderId", orderId);
                return ResponseEntity.badRequest().body(error);
            }
            
            headers.set("PayPal-Request-Id", UUID.randomUUID().toString());
            HttpEntity<Map<String, Object>> captureEntity = new HttpEntity<>(new HashMap<>(), headers);
            
            ResponseEntity<Map> captureResponse = restTemplate.postForEntity(
                paypalBaseUrl + "/v2/checkout/orders/" + orderId + "/capture",
                captureEntity,
                Map.class
            );
            
            Map<String, Object> captureData = captureResponse.getBody();
            
            List<Map<String, Object>> purchaseUnits = (List<Map<String, Object>>) captureData.get("purchase_units");
            Map<String, Object> payments = (Map<String, Object>) purchaseUnits.get(0).get("payments");
            List<Map<String, Object>> captures = (List<Map<String, Object>>) payments.get("captures");
            Map<String, Object> capture = captures.get(0);
            
            Map<String, Object> result = new HashMap<>();
            result.put("id", captureData.get("id"));
            result.put("status", captureData.get("status"));
            result.put("captureId", capture.get("id"));
            result.put("amount", capture.get("amount"));
            result.put("payer", captureData.get("payer"));
            result.put("create_time", capture.get("create_time"));
            
            return ResponseEntity.ok(result);
            
        } catch (HttpClientErrorException e) {
            if (e.getStatusCode() == HttpStatus.UNPROCESSABLE_ENTITY) {
                Map<String, Object> error = new HashMap<>();
                error.put("error", "ORDER_ALREADY_CAPTURED");
                error.put("message", "Order cannot be captured");
                return ResponseEntity.status(422).body(error);
            }
            
            Map<String, Object> error = new HashMap<>();
            error.put("error", "CAPTURE_FAILED");
            error.put("message", "Failed to capture order");
            return ResponseEntity.status(e.getStatusCode().value()).body(error);
            
        } catch (Exception e) {
            Map<String, Object> error = new HashMap<>();
            error.put("error", "CAPTURE_FAILED");
            error.put("message", "Failed to capture order");
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

