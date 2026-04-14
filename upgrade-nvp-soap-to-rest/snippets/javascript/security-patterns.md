#### Secure Logging Pattern

```js
// Secure logging pattern
const sanitizeLogData = (data) => {
    const sanitized = { ...data };
    delete sanitized.credit_card;
    delete sanitized.cvv;
    if (sanitized.payer?.funding_instruments) {
        sanitized.payer.funding_instruments = '[REDACTED]';
    }
    return sanitized;
};

// Example usage
console.log('Payment data:', sanitizeLogData(paymentData));
```

#### Input Validation Patterns

```js
// Input validation pattern
const validatePaymentAmount = (amount) => {
    if (!amount || isNaN(amount) || amount <= 0) {
        throw new Error('Invalid payment amount');
    }
    if (amount > 10000) {
        throw new Error('Payment amount exceeds maximum limit');
    }
    return parseFloat(amount).toFixed(2);
};

const validateCurrency = (currency) => {
    const validCurrencies = ['USD', 'EUR', 'GBP', 'CAD', 'AUD'];
    if (!validCurrencies.includes(currency)) {
        throw new Error('Invalid currency code');
    }
    return currency;
};

const sanitizeInput = (input) => {
    if (typeof input !== 'string') return input;
    return input.replace(/[<>\"'&]/g, '');
};
```