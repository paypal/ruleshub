# Braintree 3D Secure — client verification + server `threeDSecureInfo`

Use **3D Secure** for liability shift when supported. Client: `braintree.threeDSecure.create({ client })` then **`verifyCard`**. Drop-in can pass **`threeDSecure: true`**. Server: read **`result.transaction.threeDSecureInfo`**.

## Client: standalone 3DS after nonce

```javascript
// After braintree.client.create({ authorization: clientToken })
const threeDSecureInstance = await braintree.threeDSecure.create({
  client: clientInstance,
  version: 2,
});

const verifyPayload = await threeDSecureInstance.verifyCard({
  amount: '10.00',
  nonce: cardNonceFromHostedFieldsOrDropIn,
  bin: binFromOptionalDetails, // if available from tokenization details
  email: 'buyer@example.com',
  billingAddress: {
    givenName: 'Jane',
    surname: 'Buyer',
    streetAddress: '123 Market St',
    locality: 'San Francisco',
    region: 'CA',
    postalCode: '94105',
    countryCodeAlpha2: 'US',
  },
  onLookupComplete: (data, next) => {
    next(); // continue challenge flow
  },
});

const enrichedNonce = verifyPayload.nonce;
// Send enrichedNonce to server for transaction.sale
```

## Drop-in: enable 3DS

```javascript
const dropinInstance = await braintree.dropin.create({
  authorization: clientToken,
  container: '#dropin-container',
  threeDSecure: true,
});

const payload = await dropinInstance.requestPaymentMethod({
  threeDSecure: {
    amount: '10.00',
    email: 'buyer@example.com',
    billingAddress: { /* ... */ },
  },
});
```

## Liability shift flags

After verification, inspect the payload (and server transaction) for:

- **`liabilityShifted`** — issuer accepted liability
- **`liabilityShiftPossible`** — 3DS attempted; check processor rules

```javascript
console.log(verifyPayload.liabilityShifted, verifyPayload.liabilityShiftPossible);
```

## Server: `threeDSecureInfo` on transaction

```javascript
const result = await gateway.transaction.sale({
  amount: '10.00',
  paymentMethodNonce: enrichedNonce,
  options: { submitForSettlement: true },
});

if (result.success && result.transaction.threeDSecureInfo) {
  const info = result.transaction.threeDSecureInfo;
  console.log({
    status: info.status,
    liabilityShifted: info.liabilityShifted,
    liabilityShiftPossible: info.liabilityShiftPossible,
    enrolled: info.enrolled,
  });
}
```

Use Braintree’s docs for full field lists and edge cases (frictionless vs challenge).
