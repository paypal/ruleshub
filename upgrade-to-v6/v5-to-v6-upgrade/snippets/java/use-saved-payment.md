# Use Saved Payment (Server-Side)

## Spring Boot Implementation

```java
@RestController
@RequestMapping("/paypal-api")
public class PayPalSavedPaymentController {
    
    @Value("${paypal.client.id}")
    private String clientId;
    
    @Value("${paypal.client.secret}")
    private String clientSecret;
    
    @Value("${paypal.base.url:https://api-m.sandbox.paypal.com}")
    private String paypalBaseUrl;
    
    @GetMapping("/customer/payment-methods")
    public ResponseEntity<Map<String, Object>> getCustomerPaymentMethods(@RequestParam String customer_id) {
        try {
            if (customer_id == null || customer_id.isEmpty()) {
                Map<String, Object> error = new HashMap<>();
                error.put("error", "MISSING_CUSTOMER_ID");
                error.put("message", "customer_id is required");
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
    
    @PostMapping("/checkout/orders/create-with-saved-card")
    public ResponseEntity<Map<String, Object>> createOrderWithSavedCard(@RequestBody Map<String, Object> request) {
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
            
            Map<String, Object> card = new HashMap<>();
            card.put("vault_id", vaultId);
            
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
    
    @PostMapping("/checkout/orders/create-with-saved-paypal")
    public ResponseEntity<Map<String, Object>> createOrderWithSavedPayPal(@RequestBody Map<String, Object> request) {
        try {
            String paymentTokenId = (String) request.get("paymentTokenId");
            
            if (paymentTokenId == null || paymentTokenId.isEmpty()) {
                Map<String, Object> error = new HashMap<>();
                error.put("error", "MISSING_PAYMENT_TOKEN");
                error.put("message", "paymentTokenId is required");
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
            
            Map<String, Object> paypal = new HashMap<>();
            paypal.put("vault_id", paymentTokenId);
            
            Map<String, Object> paymentSource = new HashMap<>();
            paymentSource.put("paypal", paypal);
            
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

