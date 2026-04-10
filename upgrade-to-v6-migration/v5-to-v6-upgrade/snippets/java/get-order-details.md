# Get Order Details (Server-Side)

## Spring Boot Implementation

```java
@RestController
@RequestMapping("/paypal-api/checkout/orders")
public class PayPalOrderDetailsController {
    
    @Value("${paypal.client.id}")
    private String clientId;
    
    @Value("${paypal.client.secret}")
    private String clientSecret;
    
    @Value("${paypal.base.url:https://api-m.sandbox.paypal.com}")
    private String paypalBaseUrl;
    
    @GetMapping("/{orderId}")
    public ResponseEntity<Map<String, Object>> getOrderDetails(@PathVariable String orderId) {
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
            
            HttpEntity<String> entity = new HttpEntity<>(headers);
            RestTemplate restTemplate = new RestTemplate();
            
            ResponseEntity<Map> response = restTemplate.exchange(
                paypalBaseUrl + "/v2/checkout/orders/" + orderId,
                HttpMethod.GET,
                entity,
                Map.class
            );
            
            return ResponseEntity.ok(response.getBody());
            
        } catch (HttpClientErrorException e) {
            if (e.getStatusCode() == HttpStatus.NOT_FOUND) {
                Map<String, Object> error = new HashMap<>();
                error.put("error", "ORDER_NOT_FOUND");
                error.put("message", "Order not found");
                return ResponseEntity.status(404).body(error);
            }
            
            Map<String, Object> error = new HashMap<>();
            error.put("error", "FETCH_FAILED");
            error.put("message", "Failed to fetch order");
            return ResponseEntity.status(e.getStatusCode().value()).body(error);
            
        } catch (Exception e) {
            Map<String, Object> error = new HashMap<>();
            error.put("error", "FETCH_FAILED");
            error.put("message", "Failed to fetch order details");
            return ResponseEntity.status(500).body(error);
        }
    }
    
    @GetMapping("/{orderId}/summary")
    public ResponseEntity<Map<String, Object>> getOrderSummary(@PathVariable String orderId) {
        try {
            String accessToken = getAccessToken();
            
            HttpHeaders headers = new HttpHeaders();
            headers.set("Authorization", "Bearer " + accessToken);
            
            HttpEntity<String> entity = new HttpEntity<>(headers);
            RestTemplate restTemplate = new RestTemplate();
            
            ResponseEntity<Map> response = restTemplate.exchange(
                paypalBaseUrl + "/v2/checkout/orders/" + orderId,
                HttpMethod.GET,
                entity,
                Map.class
            );
            
            Map<String, Object> orderData = response.getBody();
            
            List<Map<String, Object>> purchaseUnits = (List<Map<String, Object>>) orderData.get("purchase_units");
            Map<String, Object> payments = (Map<String, Object>) purchaseUnits.get(0).get("payments");
            
            List<Map<String, Object>> captures = (List<Map<String, Object>>) payments.get("captures");
            List<Map<String, Object>> authorizations = (List<Map<String, Object>>) payments.get("authorizations");
            
            Map<String, Object> summary = new HashMap<>();
            summary.put("id", orderData.get("id"));
            summary.put("status", orderData.get("status"));
            summary.put("amount", purchaseUnits.get(0).get("amount"));
            summary.put("payer", orderData.get("payer"));
            summary.put("captureId", captures != null && !captures.isEmpty() ? captures.get(0).get("id") : null);
            summary.put("authorizationId", authorizations != null && !authorizations.isEmpty() ? authorizations.get(0).get("id") : null);
            summary.put("create_time", orderData.get("create_time"));
            summary.put("update_time", orderData.get("update_time"));
            
            return ResponseEntity.ok(summary);
            
        } catch (Exception e) {
            Map<String, Object> error = new HashMap<>();
            error.put("error", "FETCH_FAILED");
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

