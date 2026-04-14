#### Create Order (Basic)

```java
import org.springframework.web.bind.annotation.*;
import org.springframework.http.*;
import org.springframework.web.client.RestTemplate;
import java.util.*;

@RestController
@RequestMapping("/paypal-api/checkout/orders")
public class PayPalOrderController {
    
    private final String PAYPAL_BASE = System.getenv().getOrDefault("PAYPAL_BASE", "https://api-m.sandbox.paypal.com");
    private final RestTemplate restTemplate = new RestTemplate();
    private final PayPalTokenController tokenController;
    
    public PayPalOrderController(PayPalTokenController tokenController) {
        this.tokenController = tokenController;
    }
    
    @PostMapping("/create")
    public ResponseEntity<?> createOrder(@RequestBody Map<String, Object> requestBody) {
        try {
            String accessToken = tokenController.getAccessToken();
            
            Map<String, Object> orderPayload = new HashMap<>();
            orderPayload.put("intent", "CAPTURE");
            
            Map<String, Object> amount = new HashMap<>();
            amount.put("currency_code", requestBody.getOrDefault("currency", "USD"));
            amount.put("value", requestBody.get("amount"));
            
            Map<String, Object> purchaseUnit = new HashMap<>();
            purchaseUnit.put("amount", amount);
            
            orderPayload.put("purchase_units", Arrays.asList(purchaseUnit));
            
            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);
            headers.set("Authorization", "Bearer " + accessToken);
            headers.set("PayPal-Request-Id", UUID.randomUUID().toString());
            
            HttpEntity<Map<String, Object>> request = new HttpEntity<>(orderPayload, headers);
            
            ResponseEntity<Map> response = restTemplate.postForEntity(
                PAYPAL_BASE + "/v2/checkout/orders",
                request,
                Map.class
            );
            
            return ResponseEntity.status(response.getStatusCode()).body(response.getBody());
            
        } catch (Exception e) {
            Map<String, String> error = new HashMap<>();
            error.put("error", "ORDER_CREATION_FAILED");
            return ResponseEntity.status(500).body(error);
        }
    }
}
```

#### Create Order with Details

```java
@PostMapping("/create-with-details")
public ResponseEntity<?> createOrderWithDetails(@RequestBody Map<String, Object> requestBody) {
    try {
        String accessToken = tokenController.getAccessToken();
        
        List<Map<String, Object>> items = new ArrayList<>();
        List<Map<String, Object>> requestItems = (List<Map<String, Object>>) requestBody.getOrDefault("items", new ArrayList<>());
        
        for (Map<String, Object> item : requestItems) {
            Map<String, Object> orderItem = new HashMap<>();
            orderItem.put("name", item.get("name"));
            orderItem.put("quantity", String.valueOf(item.get("quantity")));
            
            Map<String, Object> unitAmount = new HashMap<>();
            unitAmount.put("currency_code", requestBody.getOrDefault("currency", "USD"));
            unitAmount.put("value", item.get("price"));
            orderItem.put("unit_amount", unitAmount);
            orderItem.put("sku", item.get("sku"));
            
            items.add(orderItem);
        }
        
        Map<String, Object> details = (Map<String, Object>) requestBody.getOrDefault("details", new HashMap<>());
        
        Map<String, Object> breakdown = new HashMap<>();
        breakdown.put("item_total", createAmountMap(requestBody, details.getOrDefault("subtotal", requestBody.get("amount"))));
        breakdown.put("shipping", createAmountMap(requestBody, details.getOrDefault("shipping", "0.00")));
        breakdown.put("tax_total", createAmountMap(requestBody, details.getOrDefault("tax", "0.00")));
        
        Map<String, Object> amount = new HashMap<>();
        amount.put("currency_code", requestBody.getOrDefault("currency", "USD"));
        amount.put("value", requestBody.get("amount"));
        amount.put("breakdown", breakdown);
        
        Map<String, Object> purchaseUnit = new HashMap<>();
        purchaseUnit.put("amount", amount);
        purchaseUnit.put("description", requestBody.getOrDefault("description", "Purchase"));
        purchaseUnit.put("items", items);
        
        Map<String, Object> orderPayload = new HashMap<>();
        orderPayload.put("intent", "CAPTURE");
        orderPayload.put("purchase_units", Arrays.asList(purchaseUnit));
        
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        headers.set("Authorization", "Bearer " + accessToken);
        headers.set("PayPal-Request-Id", UUID.randomUUID().toString());
        
        HttpEntity<Map<String, Object>> request = new HttpEntity<>(orderPayload, headers);
        
        ResponseEntity<Map> response = restTemplate.postForEntity(
            PAYPAL_BASE + "/v2/checkout/orders",
            request,
            Map.class
        );
        
        return ResponseEntity.status(response.getStatusCode()).body(response.getBody());
        
    } catch (Exception e) {
        Map<String, String> error = new HashMap<>();
        error.put("error", "ORDER_CREATION_FAILED");
        return ResponseEntity.status(500).body(error);
    }
}

private Map<String, Object> createAmountMap(Map<String, Object> requestBody, Object value) {
    Map<String, Object> amountMap = new HashMap<>();
    amountMap.put("currency_code", requestBody.getOrDefault("currency", "USD"));
    amountMap.put("value", value);
    return amountMap;
}
```

