# Pay Later & Credit Integration (Server-Side)

## Spring Boot Implementation

```java
@RestController
@RequestMapping("/paypal-api/checkout/orders")
public class PayPalPayLaterController {
    
    @Value("${paypal.client.id}")
    private String clientId;
    
    @Value("${paypal.client.secret}")
    private String clientSecret;
    
    @Value("${paypal.base.url:https://api-m.sandbox.paypal.com}")
    private String paypalBaseUrl;
    
    @PostMapping("/create-paylater")
    public ResponseEntity<Map<String, Object>> createOrderForPayLater(@RequestBody Map<String, Object> request) {
        try {
            String accessToken = getAccessToken();
            String amount = (String) request.get("amount");
            String currency = (String) request.getOrDefault("currency", "USD");
            
            Map<String, Object> amountObj = new HashMap<>();
            amountObj.put("currency_code", currency);
            amountObj.put("value", String.format("%.2f", Double.parseDouble(amount)));
            
            Map<String, Object> purchaseUnit = new HashMap<>();
            purchaseUnit.put("amount", amountObj);
            purchaseUnit.put("description", request.getOrDefault("description", "Purchase"));
            
            Map<String, Object> experienceContext = new HashMap<>();
            experienceContext.put("payment_method_preference", "IMMEDIATE_PAYMENT_REQUIRED");
            experienceContext.put("brand_name", request.getOrDefault("brand_name", "Your Store"));
            experienceContext.put("locale", "en-US");
            experienceContext.put("shipping_preference", "NO_SHIPPING");
            experienceContext.put("user_action", "PAY_NOW");
            experienceContext.put("return_url", "https://example.com/success");
            experienceContext.put("cancel_url", "https://example.com/cancel");
            
            Map<String, Object> payUponInvoice = new HashMap<>();
            payUponInvoice.put("experience_context", experienceContext);
            
            Map<String, Object> paymentSource = new HashMap<>();
            paymentSource.put("pay_upon_invoice", payUponInvoice);
            
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
    
    @PostMapping("/create-credit")
    public ResponseEntity<Map<String, Object>> createOrderForCredit(@RequestBody Map<String, Object> request) {
        try {
            String accessToken = getAccessToken();
            String amount = (String) request.get("amount");
            String currency = (String) request.getOrDefault("currency", "USD");
            
            Map<String, Object> amountObj = new HashMap<>();
            amountObj.put("currency_code", currency);
            amountObj.put("value", String.format("%.2f", Double.parseDouble(amount)));
            
            Map<String, Object> itemTotal = new HashMap<>();
            itemTotal.put("currency_code", currency);
            itemTotal.put("value", String.format("%.2f", Double.parseDouble(amount)));
            
            Map<String, Object> breakdown = new HashMap<>();
            breakdown.put("item_total", itemTotal);
            
            amountObj.put("breakdown", breakdown);
            
            Map<String, Object> purchaseUnit = new HashMap<>();
            purchaseUnit.put("amount", amountObj);
            purchaseUnit.put("items", request.get("items"));
            
            Map<String, Object> experienceContext = new HashMap<>();
            experienceContext.put("payment_method_preference", "IMMEDIATE_PAYMENT_REQUIRED");
            experienceContext.put("brand_name", request.getOrDefault("brand_name", "Your Store"));
            experienceContext.put("locale", "en-US");
            experienceContext.put("landing_page", "LOGIN");
            experienceContext.put("shipping_preference", "NO_SHIPPING");
            experienceContext.put("user_action", "PAY_NOW");
            experienceContext.put("return_url", "https://example.com/success");
            experienceContext.put("cancel_url", "https://example.com/cancel");
            
            Map<String, Object> paypal = new HashMap<>();
            paypal.put("experience_context", experienceContext);
            
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

