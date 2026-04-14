#### Enhanced Error Handling with Debug IDs

```java
import org.springframework.web.bind.annotation.*;
import org.springframework.http.*;
import org.springframework.web.client.*;
import java.util.*;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

@PostMapping("/create-with-error-handling")
public ResponseEntity<?> createOrderWithErrorHandling(@RequestBody Map<String, Object> requestBody) {
    Logger logger = LoggerFactory.getLogger(getClass());
    
    try {
        String accessToken = tokenController.getAccessToken();
        
        Map<String, Object> amount = new HashMap<>();
        amount.put("currency_code", requestBody.getOrDefault("currency", "USD"));
        amount.put("value", requestBody.get("amount"));
        
        Map<String, Object> purchaseUnit = new HashMap<>();
        purchaseUnit.put("amount", amount);
        
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
        
        return ResponseEntity.ok(response.getBody());
        
    } catch (HttpClientErrorException | HttpServerErrorException e) {
        String debugId = e.getResponseHeaders() != null ? 
            e.getResponseHeaders().getFirst("PayPal-Debug-Id") : "N/A";
        
        Map<String, Object> errorData = new HashMap<>();
        try {
            errorData = new ObjectMapper().readValue(e.getResponseBodyAsString(), Map.class);
        } catch (Exception ex) {
            errorData.put("message", "Failed to parse error response");
        }
        
        logger.error("Order creation failed - Debug ID: {}", debugId);
        logger.error("Status: {}", e.getStatusCode().value());
        logger.error("Error: {}", errorData);
        
        Map<String, Object> error = new HashMap<>();
        error.put("error", "ORDER_CREATION_FAILED");
        error.put("debugId", debugId);
        error.put("status", e.getStatusCode().value());
        error.put("details", errorData.get("details"));
        error.put("message", errorData.getOrDefault("message", "Failed to create order"));
        
        return ResponseEntity.status(e.getStatusCode()).body(error);
        
    } catch (Exception e) {
        logger.error("Unexpected error", e);
        
        Map<String, String> error = new HashMap<>();
        error.put("error", "INTERNAL_ERROR");
        error.put("message", "An unexpected error occurred");
        
        return ResponseEntity.status(500).body(error);
    }
}
```

#### Error Handler Class

```java
import org.springframework.web.bind.annotation.*;
import org.springframework.http.*;
import com.fasterxml.jackson.databind.ObjectMapper;

@ControllerAdvice
public class PayPalErrorHandler {
    
    private static final Logger logger = LoggerFactory.getLogger(PayPalErrorHandler.class);
    
    @ExceptionHandler(HttpClientErrorException.class)
    public ResponseEntity<?> handleHttpClientError(HttpClientErrorException e) {
        String debugId = e.getResponseHeaders() != null ? 
            e.getResponseHeaders().getFirst("PayPal-Debug-Id") : "N/A";
        
        Map<String, Object> errorData = parseErrorResponse(e.getResponseBodyAsString());
        
        logger.error("PayPal API Error - Debug ID: {}", debugId);
        logger.error("Status: {}", e.getStatusCode().value());
        logger.error("Details: {}", errorData);
        
        Map<String, Object> error = new HashMap<>();
        error.put("error", errorData.getOrDefault("name", "API_ERROR"));
        error.put("debugId", debugId);
        error.put("message", errorData.getOrDefault("message", "PayPal API error"));
        error.put("details", errorData.get("details"));
        
        return ResponseEntity.status(e.getStatusCode()).body(error);
    }
    
    @ExceptionHandler(HttpServerErrorException.class)
    public ResponseEntity<?> handleHttpServerError(HttpServerErrorException e) {
        String debugId = e.getResponseHeaders() != null ? 
            e.getResponseHeaders().getFirst("PayPal-Debug-Id") : "N/A";
        
        logger.error("PayPal Server Error - Debug ID: {}", debugId);
        
        Map<String, String> error = new HashMap<>();
        error.put("error", "SERVER_ERROR");
        error.put("debugId", debugId);
        error.put("message", "PayPal server error");
        
        return ResponseEntity.status(503).body(error);
    }
    
    private Map<String, Object> parseErrorResponse(String responseBody) {
        try {
            return new ObjectMapper().readValue(responseBody, Map.class);
        } catch (Exception e) {
            Map<String, Object> fallback = new HashMap<>();
            fallback.put("message", "Failed to parse error");
            return fallback;
        }
    }
}
```

#### Specific Error Handlers

```java
public class PayPalErrorUtils {
    
    public static Map<String, Object> handleValidationError(String responseBody, String debugId) {
        Map<String, Object> errorData = parseJson(responseBody);
        List<Map<String, Object>> fieldErrors = new ArrayList<>();
        
        List<Map<String, Object>> details = (List<Map<String, Object>>) errorData.get("details");
        if (details != null) {
            for (Map<String, Object> detail : details) {
                Map<String, Object> fieldError = new HashMap<>();
                fieldError.put("field", detail.get("field"));
                fieldError.put("issue", detail.get("issue"));
                fieldError.put("description", detail.get("description"));
                fieldErrors.add(fieldError);
            }
        }
        
        Map<String, Object> result = new HashMap<>();
        result.put("error", "VALIDATION_ERROR");
        result.put("debugId", debugId);
        result.put("message", "Invalid request data");
        result.put("fieldErrors", fieldErrors);
        
        return result;
    }
    
    public static Map<String, Object> handleAuthenticationError(String debugId) {
        Map<String, Object> result = new HashMap<>();
        result.put("error", "AUTHENTICATION_FAILED");
        result.put("debugId", debugId);
        result.put("message", "Invalid or expired credentials");
        return result;
    }
    
    public static Map<String, Object> handlePaymentError(String responseBody, String debugId) {
        Map<String, Object> errorData = parseJson(responseBody);
        String errorName = (String) errorData.getOrDefault("name", "");
        String userMessage = "Payment could not be processed";
        
        if (errorName.contains("INSTRUMENT_DECLINED")) {
            userMessage = "Payment method was declined. Please try another payment method.";
        } else if (errorName.contains("INSUFFICIENT_FUNDS")) {
            userMessage = "Insufficient funds. Please try another payment method.";
        } else if (errorName.contains("ORDER_NOT_APPROVED")) {
            userMessage = "Order was not approved. Please try again.";
        }
        
        Map<String, Object> result = new HashMap<>();
        result.put("error", errorName);
        result.put("debugId", debugId);
        result.put("message", userMessage);
        result.put("details", errorData.get("details"));
        
        return result;
    }
    
    private static Map<String, Object> parseJson(String json) {
        try {
            return new ObjectMapper().readValue(json, Map.class);
        } catch (Exception e) {
            return new HashMap<>();
        }
    }
}
```

#### Error Logger

```java
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

public class PayPalErrorLogger {
    
    private static final Logger logger = LoggerFactory.getLogger(PayPalErrorLogger.class);
    
    public static void logError(String operation, String debugId, int statusCode, 
                               Map<String, Object> errorData, Map<String, Object> requestData) {
        logger.error("PayPal API Error:");
        logger.error("  Operation: {}", operation);
        logger.error("  Debug ID: {}", debugId);
        logger.error("  Status Code: {}", statusCode);
        logger.error("  Error Name: {}", errorData.get("name"));
        logger.error("  Error Message: {}", errorData.get("message"));
        logger.error("  Error Details: {}", errorData.get("details"));
        if (requestData != null) {
            logger.error("  Request Data: {}", requestData);
        }
    }
}
```

