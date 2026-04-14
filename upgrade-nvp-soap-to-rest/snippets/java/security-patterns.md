#### Secure Logging Pattern

```java
// Secure logging pattern
public class SecureLogging {
    
    public static JsonElement sanitizeLogData(Object data) {
        if (data == null) return null;
        
        String json = gson.toJson(data);
        JsonElement sanitized = JsonParser.parseString(json);
        
        // Remove sensitive fields
        removeSensitiveFields(sanitized);
        
        return sanitized;
    }
    
    private static void removeSensitiveFields(JsonElement element) {
        if (element.isJsonObject()) {
            JsonObject obj = element.getAsJsonObject();
            Set<String> propertiesToRemove = new HashSet<>();
            
            for (Map.Entry<String, JsonElement> entry : obj.entrySet()) {
                String propertyName = entry.getKey().toLowerCase();
                
                // Remove sensitive fields
                if (propertyName.contains("credit_card") || 
                    propertyName.contains("cvv") || 
                    propertyName.contains("card_number") ||
                    propertyName.contains("security_code")) {
                    propertiesToRemove.add(entry.getKey());
                } else if (propertyName.equals("funding_instruments")) {
                    obj.addProperty(entry.getKey(), "[REDACTED]");
                } else {
                    removeSensitiveFields(entry.getValue());
                }
            }
            
            for (String prop : propertiesToRemove) {
                obj.remove(prop);
            }
        } else if (element.isJsonArray()) {
            JsonArray array = element.getAsJsonArray();
            for (JsonElement item : array) {
                removeSensitiveFields(item);
            }
        }
    }
}

// Example usage
System.out.println("Payment data: " + gson.toJson(SecureLogging.sanitizeLogData(paymentData)));
```

#### Input Validation Patterns

```java
// Input validation pattern
public class PaymentValidator {
    
    public static String validatePaymentAmount(Object amount) {
        if (amount == null) {
            throw new IllegalArgumentException("Invalid payment amount");
        }
        
        BigDecimal parsedAmount;
        try {
            parsedAmount = new BigDecimal(amount.toString());
        } catch (NumberFormatException e) {
            throw new IllegalArgumentException("Invalid payment amount");
        }
        
        if (parsedAmount.compareTo(BigDecimal.ZERO) <= 0) {
            throw new IllegalArgumentException("Invalid payment amount");
        }
        
        if (parsedAmount.compareTo(new BigDecimal("10000")) > 0) {
            throw new IllegalArgumentException("Payment amount exceeds maximum limit");
        }
        
        return parsedAmount.setScale(2, RoundingMode.HALF_UP).toString();
    }
    
    public static String validateCurrency(String currency) {
        if (currency == null || currency.trim().isEmpty()) {
            throw new IllegalArgumentException("Invalid currency code");
        }
        
        Set<String> validCurrencies = Set.of("USD", "EUR", "GBP", "CAD", "AUD");
        
        if (!validCurrencies.contains(currency.toUpperCase())) {
            throw new IllegalArgumentException("Invalid currency code");
        }
        
        return currency.toUpperCase();
    }
    
    public static String sanitizeInput(Object input) {
        if (input == null) {
            return "";
        }
        
        if (!(input instanceof String)) {
            return input.toString();
        }
        
        String stringInput = (String) input;
        return stringInput.replaceAll("[<>\"'&]", "");
    }
    
    public static String validateEmail(String email) {
        if (email == null || email.trim().isEmpty()) {
            throw new IllegalArgumentException("Email is required");
        }
        
        Pattern emailPattern = Pattern.compile("^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$");
        if (!emailPattern.matcher(email).matches()) {
            throw new IllegalArgumentException("Invalid email format");
        }
        
        return email.toLowerCase();
    }
    
    public static String validateReturnUrl(String url) {
        if (url == null || url.trim().isEmpty()) {
            throw new IllegalArgumentException("Return URL is required");
        }
        
        try {
            URI validatedUri = new URI(url);
            
            if (!validatedUri.isAbsolute()) {
                throw new IllegalArgumentException("Invalid return URL format");
            }
            
            if (!"https".equals(validatedUri.getScheme())) {
                throw new IllegalArgumentException("Return URL must use HTTPS");
            }
            
            return url;
        } catch (URISyntaxException e) {
            throw new IllegalArgumentException("Invalid return URL format");
        }
    }
}
```