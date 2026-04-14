#### Secure Logging Pattern

```csharp
// Secure logging pattern
public static class SecureLogging
{
    public static object SanitizeLogData(object data)
    {
        if (data == null) return null;
        
        var json = JsonConvert.SerializeObject(data);
        var sanitized = JsonConvert.DeserializeObject<JObject>(json);
        
        // Remove sensitive fields
        RemoveSensitiveFields(sanitized);
        
        return sanitized;
    }
    
    private static void RemoveSensitiveFields(JToken token)
    {
        if (token.Type == JTokenType.Object)
        {
            var obj = (JObject)token;
            var propertiesToRemove = new List<string>();
            
            foreach (var property in obj.Properties())
            {
                var propertyName = property.Name.ToLowerInvariant();
                
                // Remove sensitive fields
                if (propertyName.Contains("credit_card") || 
                    propertyName.Contains("cvv") || 
                    propertyName.Contains("card_number") ||
                    propertyName.Contains("security_code"))
                {
                    propertiesToRemove.Add(property.Name);
                }
                else if (propertyName == "funding_instruments")
                {
                    property.Value = "[REDACTED]";
                }
                else
                {
                    RemoveSensitiveFields(property.Value);
                }
            }
            
            foreach (var prop in propertiesToRemove)
            {
                obj.Remove(prop);
            }
        }
        else if (token.Type == JTokenType.Array)
        {
            foreach (var item in token)
            {
                RemoveSensitiveFields(item);
            }
        }
    }
}

// Example usage
Console.WriteLine($"Payment data: {JsonConvert.SerializeObject(SecureLogging.SanitizeLogData(paymentData))}");
```

#### Input Validation Patterns

```csharp
// Input validation pattern
public static class PaymentValidator
{
    public static string ValidatePaymentAmount(object amount)
    {
        if (amount == null)
            throw new ArgumentException("Invalid payment amount");
            
        if (!decimal.TryParse(amount.ToString(), out decimal parsedAmount))
            throw new ArgumentException("Invalid payment amount");
            
        if (parsedAmount <= 0)
            throw new ArgumentException("Invalid payment amount");
            
        if (parsedAmount > 10000)
            throw new ArgumentException("Payment amount exceeds maximum limit");
            
        return parsedAmount.ToString("F2");
    }
    
    public static string ValidateCurrency(string currency)
    {
        if (string.IsNullOrWhiteSpace(currency))
            throw new ArgumentException("Invalid currency code");
            
        var validCurrencies = new HashSet<string> { "USD", "EUR", "GBP", "CAD", "AUD" };
        
        if (!validCurrencies.Contains(currency.ToUpperInvariant()))
            throw new ArgumentException("Invalid currency code");
            
        return currency.ToUpperInvariant();
    }
    
    public static string SanitizeInput(object input)
    {
        if (input == null || input is not string stringInput)
            return input?.ToString() ?? string.Empty;
            
        return Regex.Replace(stringInput, @"[<>""'&]", string.Empty);
    }
    
    public static string ValidateEmail(string email)
    {
        if (string.IsNullOrWhiteSpace(email))
            throw new ArgumentException("Email is required");
            
        var emailRegex = new Regex(@"^[^@\s]+@[^@\s]+\.[^@\s]+$");
        if (!emailRegex.IsMatch(email))
            throw new ArgumentException("Invalid email format");
            
        return email.ToLowerInvariant();
    }
    
    public static string ValidateReturnUrl(string url)
    {
        if (string.IsNullOrWhiteSpace(url))
            throw new ArgumentException("Return URL is required");
            
        if (!Uri.TryCreate(url, UriKind.Absolute, out Uri? validatedUri))
            throw new ArgumentException("Invalid return URL format");
            
        if (validatedUri.Scheme != "https")
            throw new ArgumentException("Return URL must use HTTPS");
            
        return url;
    }
}
```