#### Secure Logging Pattern

```py
def sanitize_log_data(data):
    sanitized = data.copy()
    
    # Remove sensitive fields
    sensitive_fields = ['credit_card', 'cvv', 'cvv2', 'account_number']
    for field in sensitive_fields:
        if field in sanitized:
            del sanitized[field]
    
    # Redact funding instruments
    if 'payer' in sanitized and 'funding_instruments' in sanitized['payer']:
        sanitized['payer']['funding_instruments'] = '[REDACTED]'
    
    return sanitized

# Example usage
logger.info('Payment data: %s', sanitize_log_data(payment_data))
```

#### Input Validation Patterns

```py
import re
from decimal import Decimal, InvalidOperation

def validate_payment_amount(amount):
    try:
        amount = Decimal(str(amount))
        if amount <= 0:
            raise ValueError('Payment amount must be positive')
        if amount > Decimal('10000'):
            raise ValueError('Payment amount exceeds maximum limit')
        return amount.quantize(Decimal('0.01'))
    except (InvalidOperation, TypeError):
        raise ValueError('Invalid payment amount format')

def validate_currency(currency):
    valid_currencies = {'USD', 'EUR', 'GBP', 'CAD', 'AUD'}
    if currency not in valid_currencies:
        raise ValueError('Invalid currency code')
    return currency

def sanitize_input(input_str):
    if not isinstance(input_str, str):
        return input_str
    return re.sub(r'[<>\"\'&]', '', input_str)
```