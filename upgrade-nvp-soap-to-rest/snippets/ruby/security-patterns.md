#### Secure Logging Pattern

```rb
# Secure logging pattern
def sanitize_log_data(data)
  return data unless data.is_a?(Hash)
  
  sanitized = data.dup
  
  # Remove sensitive fields
  sensitive_fields = ['credit_card', 'cvv', 'cvv2', 'account_number']
  sensitive_fields.each do |field|
    sanitized.delete(field)
  end
  
  # Redact funding instruments
  if sanitized['payer'] && sanitized['payer']['funding_instruments']
    sanitized['payer']['funding_instruments'] = '[REDACTED]'
  end
  
  sanitized
end

# Example usage
logger.info("Payment data: #{sanitize_log_data(payment_data)}")
```

#### Input Validation Patterns

```rb
require 'bigdecimal'

# Input validation methods
def validate_payment_amount(amount)
  begin
    amount = BigDecimal(amount.to_s)
    
    if amount <= 0
      raise ArgumentError, 'Payment amount must be positive'
    end
    
    if amount > BigDecimal('10000')
      raise ArgumentError, 'Payment amount exceeds maximum limit'
    end
    
    # Round to 2 decimal places
    amount.round(2)
  rescue ArgumentError => e
    raise e
  rescue => e
    raise ArgumentError, 'Invalid payment amount format'
  end
end

def validate_currency(currency)
  valid_currencies = %w[USD EUR GBP CAD AUD].to_set
  
  unless valid_currencies.include?(currency)
    raise ArgumentError, 'Invalid currency code'
  end
  
  currency
end

def sanitize_input(input_str)
  return input_str unless input_str.is_a?(String)
  
  input_str.gsub(/[<>"'&]/, '')
end
```