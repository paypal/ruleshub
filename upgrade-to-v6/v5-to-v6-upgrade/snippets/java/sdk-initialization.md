# SDK Initialization (Server Support)

## Spring Boot Implementation

```java
@RestController
@CrossOrigin(origins = "*")
public class PayPalSdkInitController {
    
    @Value("${paypal.client.id}")
    private String clientId;
    
    @Value("${paypal.client.secret}")
    private String clientSecret;
    
    @Value("${paypal.base.url:https://api-m.sandbox.paypal.com}")
    private String paypalBaseUrl;
    
    private String cachedToken = null;
    private LocalDateTime tokenExpiration = null;
    
    @GetMapping("/paypal-api/auth/browser-safe-client-token")
    public ResponseEntity<Map<String, Object>> getClientToken() {
        try {
            if (cachedToken != null && tokenExpiration != null && LocalDateTime.now().isBefore(tokenExpiration)) {
                long expiresIn = Duration.between(LocalDateTime.now(), tokenExpiration).getSeconds();
                Map<String, Object> response = new HashMap<>();
                response.put("accessToken", cachedToken);
                response.put("expiresIn", expiresIn);
                return ResponseEntity.ok(response);
            }
            
            String auth = Base64.getEncoder().encodeToString((clientId + ":" + clientSecret).getBytes());
            
            HttpHeaders headers = new HttpHeaders();
            headers.set("Authorization", "Basic " + auth);
            headers.setContentType(MediaType.APPLICATION_FORM_URLENCODED);
            
            String body = "grant_type=client_credentials&response_type=client_token&intent=sdk_init";
            
            HttpEntity<String> entity = new HttpEntity<>(body, headers);
            RestTemplate restTemplate = new RestTemplate();
            
            ResponseEntity<Map> tokenResponse = restTemplate.postForEntity(
                paypalBaseUrl + "/v1/oauth2/token",
                entity,
                Map.class
            );
            
            Map<String, Object> tokenData = tokenResponse.getBody();
            String accessToken = (String) tokenData.get("access_token");
            Integer expiresIn = (Integer) tokenData.get("expires_in");
            
            cachedToken = accessToken;
            tokenExpiration = LocalDateTime.now().plusSeconds(expiresIn - 120);
            
            Map<String, Object> response = new HashMap<>();
            response.put("accessToken", accessToken);
            response.put("expiresIn", expiresIn);
            
            return ResponseEntity.ok(response);
            
        } catch (Exception e) {
            Map<String, Object> error = new HashMap<>();
            error.put("error", "TOKEN_GENERATION_FAILED");
            return ResponseEntity.status(500).body(error);
        }
    }
    
    @GetMapping("/")
    public String index() {
        return "index.html";
    }
}
```

## Application Properties

```properties
paypal.client.id=your_client_id_here
paypal.client.secret=your_client_secret_here
paypal.base.url=https://api-m.sandbox.paypal.com
server.port=3000
```

## HTML Template (static/index.html)

```html
<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>PayPal v6 Integration</title>
</head>
<body>
  <h1>PayPal v6 Checkout</h1>
  
  <div id="loading" class="loading">
    <p>Loading payment options...</p>
  </div>
  
  <div id="error" class="error" style="display:none;">
    <p id="error-message"></p>
  </div>
  
  <div class="buttons-container">
    <paypal-button 
      id="paypal-button" 
      type="pay" 
      class="paypal-gold" 
      hidden>
    </paypal-button>
  </div>
  
  <script src="app.js"></script>
  <script 
    async 
    src="https://www.sandbox.paypal.com/web-sdk/v6/core" 
    onload="onPayPalWebSdkLoaded()">
  </script>
</body>
</html>
```

