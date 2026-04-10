# Braintree Vault — customers, vaulted payment methods, charging tokens

Vault lets you store payment methods for **repeat purchases** without handling raw card data again. Patterns: **vault on successful transaction**, **vault without a sale** (`paymentMethod.create` + optional `verifyCard`), and **charge by `paymentMethodToken`**.

## Gateway (reuse)

```javascript
import { createBraintreeGateway } from './braintree-gateway.js';
const gateway = createBraintreeGateway();
```

## Customer CRUD

### Create

```javascript
const result = await gateway.customer.create({
  id: 'my_customer_123', // optional custom id if not taken
  firstName: 'Jane',
  lastName: 'Buyer',
  email: 'jane@example.com',
});

if (result.success) {
  console.log('customer id', result.customer.id);
}
```

### Find

```javascript
const found = await gateway.customer.find('braintree_customer_id');
console.log(found.paymentMethods);
```

### Update

```javascript
await gateway.customer.update('braintree_customer_id', {
  firstName: 'Janet',
});
```

### Delete

```javascript
await gateway.customer.delete('braintree_customer_id');
```

## Vault with transaction (`storeInVaultOnSuccess`)

```javascript
const sale = await gateway.transaction.sale({
  amount: '25.00',
  paymentMethodNonce,
  customer: {
    firstName: 'Jane',
    lastName: 'Buyer',
    email: 'jane@example.com',
  },
  options: {
    submitForSettlement: true,
    storeInVaultOnSuccess: true,
  },
});
```

## Vault without transaction (`paymentMethod.create`)

```javascript
const pm = await gateway.paymentMethod.create({
  customerId: 'braintree_customer_id',
  paymentMethodNonce,
  options: {
    verifyCard: true, // verification charge / AVS/CVV per your settings
    verificationMerchantAccountId: 'your_merchant_account_id', // if needed
  },
});

if (pm.success) {
  console.log('token', pm.paymentMethod.token);
}
```

## Charge a saved method (`paymentMethodToken`)

```javascript
const charge = await gateway.transaction.sale({
  amount: '15.00',
  paymentMethodToken: 'token_from_vault',
  options: { submitForSettlement: true },
});
```

## Client token with `customerId`

When the buyer has a customer record, generate the client token with **`customerId`** so Drop-in / Hosted Fields can show vaulted methods:

```javascript
await gateway.clientToken.generate({ customerId: 'braintree_customer_id' });
```

See `braintree-client-token.md`.
