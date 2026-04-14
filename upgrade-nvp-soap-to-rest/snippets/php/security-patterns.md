#### Secure Logging Pattern

```php
<?php
function sanitizeLogData($data) {
    $sanitized = $data;
    
    // Remove sensitive fields
    $sensitiveFields = ['credit_card', 'cvv', 'cvv2', 'account_number'];
    foreach ($sensitiveFields as $field) {
        unset($sanitized[$field]);
    }
    
    // Redact funding instruments
    if (isset($sanitized['payer']['funding_instruments'])) {
        $sanitized['payer']['funding_instruments'] = '[REDACTED]';
    }
    
    return $sanitized;
}

// Example usage
error_log('Payment data: ' . json_encode(sanitizeLogData($paymentData)));
?>
```

#### Input Validation Patterns

```php
<?php
function validatePaymentAmount($amount) {
    if (!is_numeric($amount) || $amount <= 0) {
        throw new InvalidArgumentException('Invalid payment amount');
    }
    if ($amount > 10000) {
        throw new InvalidArgumentException('Payment amount exceeds maximum limit');
    }
    return number_format($amount, 2, '.', '');
}

function validateCurrency($currency) {
    $validCurrencies = ['USD', 'EUR', 'GBP', 'CAD', 'AUD'];
    if (!in_array($currency, $validCurrencies)) {
        throw new InvalidArgumentException('Invalid currency code');
    }
    return $currency;
}

function sanitizeInput($input) {
    if (!is_string($input)) return $input;
    return htmlspecialchars($input, ENT_QUOTES, 'UTF-8');
}
?>
```