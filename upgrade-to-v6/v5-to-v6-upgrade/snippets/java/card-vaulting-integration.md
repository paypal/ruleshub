# Card Vaulting Integration (Server-Side)

## Spring Boot Implementation

```java
@RestController
@RequestMapping("/paypal-api/checkout/orders")
public class PayPalCardVaultingController {
    
    @Value("${paypal.client.id}")
    private String clientId;
    
    @Value("${paypal.client.secret}")
    private String clientSecret;
    
    @Value("${paypal.base.url:https://api-m.sandbox.paypal.com}")
    private String paypalBaseUrl;
    
    @PostMapping("/create-with-vault")
    public ResponseEntity<Map<String, Object>> createOrderWithVault(@RequestBody Map<String, Object> request) {
        try {
            String accessToken = getAccessToken();
            String amount = (String) request.get("amount");
            String currency = (String) request.getOrDefault("currency", "USD");
            
            Map<String, Object> orderPayload = new HashMap<>();
            orderPayload.put("intent", "CAPTURE");
            
            Map<String, Object> amountObj = new HashMap<>();
            amountObj.put("currency_code", currency);
            amountObj.put("value", String.format("%.2f", Double.parseDouble(amount)));
            
            Map<String, Object> purchaseUnit = new HashMap<>();
            purchaseUnit.put("amount", amountObj);
            
            orderPayload.put("purchase_units", Arrays.asList(purchaseUnit));
            
            if (Boolean.TRUE.equals(request.get("saveCard"))) {
                Map<String, Object> verification = new HashMap<>();
                verification.put("method", "SCA_WHEN_REQUIRED");
                
                Map<String, Object> vault = new HashMap<>();
                vault.put("store_in_vault", "ON_SUCCESS");
                vault.put("usage_type", "MERCHANT");
                vault.put("customer_type", "CONSUMER");
                vault.put("permit_multiple_payment_tokens", true);
                
                Map<String, Object> attributes = new HashMap<>();
                attributes.put("verification", verification);
                attributes.put("vault", vault);
                
                Map<String, Object> card = new HashMap<>();
                card.put("attributes", attributes);
                
                Map<String, Object> paymentSource = new HashMap<>();
                paymentSource.put("card", card);
                
                orderPayload.put("payment_source", paymentSource);
            }
            
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
    
    @PostMapping("/create-with-vault-id")
    public ResponseEntity<Map<String, Object>> createOrderWithVaultId(@RequestBody Map<String, Object> request) {
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
            String orderId = (String) orderData.get("id");
            
            headers.set("PayPal-Request-Id", UUID.randomUUID().toString());
            HttpEntity<Map<String, Object>> captureEntity = new HttpEntity<>(new HashMap<>(), headers);
            
            ResponseEntity<Map> captureResponse = restTemplate.postForEntity(
                paypalBaseUrl + "/v2/checkout/orders/" + orderId + "/capture",
                captureEntity,
                Map.class
            );
            
            return ResponseEntity.ok(captureResponse.getBody());
            
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

