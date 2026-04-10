# Error Handling (Server-Side)

## Spring Boot Implementation

```java
@RestController
@RequestMapping("/paypal-api")
public class PayPalErrorHandlingController {
    
    @Value("${paypal.client.id}")
    private String clientId;
    
    @Value("${paypal.client.secret}")
    private String clientSecret;
    
    @Value("${paypal.base.url:https://api-m.sandbox.paypal.com}")
    private String paypalBaseUrl;
    
    @PostMapping("/checkout/orders/create-with-error-handling")
    public ResponseEntity<Map<String, Object>> createOrderWithErrorHandling(@RequestBody Map<String, Object> request) {
        try {
            String accessToken = getAccessToken();
            String amount = (String) request.get("amount");
            String currency = (String) request.getOrDefault("currency", "USD");
            
            Map<String, Object> amountObj = new HashMap<>();
            amountObj.put("currency_code", currency);
            amountObj.put("value", String.format("%.2f", Double.parseDouble(amount)));
            
            Map<String, Object> purchaseUnit = new HashMap<>();
            purchaseUnit.put("amount", amountObj);
            
            Map<String, Object> orderPayload = new HashMap<>();
            orderPayload.put("intent", "CAPTURE");
            orderPayload.put("purchase_units", Arrays.asList(purchaseUnit));
            
            HttpHeaders headers = new HttpHeaders();
            headers.set("Authorization", "Bearer " + accessToken);
            headers.setContentType(MediaType.APPLICATION_JSON);
            
            HttpEntity<Map<String, Object>> entity = new HttpEntity<>(orderPayload, headers);
            RestTemplate restTemplate = new RestTemplate();
            
            ResponseEntity<Map> response = restTemplate.postForEntity(
                paypalBaseUrl + "/v2/checkout/orders",
                entity,
                Map.class
            );
            
            return ResponseEntity.ok(response.getBody());
            
        } catch (HttpClientErrorException e) {
            String debugId = e.getResponseHeaders() != null ? 
                e.getResponseHeaders().getFirst("PayPal-Debug-Id") : "N/A";
            
            logPayPalError("create_order", debugId, e.getStatusCode().value(), e.getResponseBodyAsString());
            
            if (e.getStatusCode() == HttpStatus.BAD_REQUEST) {
                return ResponseEntity.status(400).body(handleValidationError(e.getResponseBodyAsString(), debugId));
            } else if (e.getStatusCode() == HttpStatus.UNAUTHORIZED) {
                return ResponseEntity.status(401).body(handleAuthenticationError(debugId));
            } else if (e.getStatusCode() == HttpStatus.UNPROCESSABLE_ENTITY) {
                return ResponseEntity.status(422).body(handlePaymentError(e.getResponseBodyAsString(), debugId));
            }
            
            Map<String, Object> error = new HashMap<>();
            error.put("error", "ORDER_CREATION_FAILED");
            error.put("debugId", debugId);
            error.put("message", "Failed to create order");
            return ResponseEntity.status(e.getStatusCode().value()).body(error);
            
        } catch (Exception e) {
            Map<String, Object> error = new HashMap<>();
            error.put("error", "INTERNAL_ERROR");
            error.put("message", "An unexpected error occurred");
            return ResponseEntity.status(500).body(error);
        }
    }
    
    private Map<String, Object> handleValidationError(String responseBody, String debugId) {
        Map<String, Object> error = new HashMap<>();
        error.put("error", "VALIDATION_ERROR");
        error.put("debugId", debugId);
        error.put("message", "Invalid request data");
        return error;
    }
    
    private Map<String, Object> handleAuthenticationError(String debugId) {
        Map<String, Object> error = new HashMap<>();
        error.put("error", "AUTHENTICATION_FAILED");
        error.put("debugId", debugId);
        error.put("message", "Invalid or expired credentials");
        return error;
    }
    
    private Map<String, Object> handlePaymentError(String responseBody, String debugId) {
        Map<String, Object> error = new HashMap<>();
        error.put("error", "PAYMENT_ERROR");
        error.put("debugId", debugId);
        error.put("message", "Payment could not be processed");
        return error;
    }
    
    private void logPayPalError(String operation, String debugId, int statusCode, String errorBody) {
        System.err.println("PayPal API Error:");
        System.err.println("  Operation: " + operation);
        System.err.println("  Debug ID: " + debugId);
        System.err.println("  Status Code: " + statusCode);
        System.err.println("  Error Body: " + errorBody);
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

@ControllerAdvice
public class GlobalExceptionHandler {
    
    @ExceptionHandler(HttpClientErrorException.class)
    public ResponseEntity<Map<String, Object>> handleHttpClientError(HttpClientErrorException e) {
        Map<String, Object> error = new HashMap<>();
        error.put("error", "HTTP_ERROR");
        error.put("status", e.getStatusCode().value());
        error.put("message", "Request failed");
        return ResponseEntity.status(e.getStatusCode()).body(error);
    }
    
    @ExceptionHandler(Exception.class)
    public ResponseEntity<Map<String, Object>> handleGenericException(Exception e) {
        Map<String, Object> error = new HashMap<>();
        error.put("error", "INTERNAL_SERVER_ERROR");
        error.put("message", "An internal error occurred");
        return ResponseEntity.status(500).body(error);
    }
}
```

