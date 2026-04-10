# Braintree transactions — sale, void, refund, settlement, status, deviceData

Use **`gateway.transaction.sale()`** on the server with the **payment method nonce** from Drop-in, Hosted Fields, or 3DS. Include **`deviceData`** when available for fraud scoring.

## Sale (authorize + optional settle)

```javascript
// server/routes/transactions.js
import { Router } from 'express';
import { createBraintreeGateway } from '../braintree-gateway.js';

const router = Router();
const gateway = createBraintreeGateway();

router.post('/api/braintree/charge', async (req, res) => {
  const { paymentMethodNonce, amount, deviceData } = req.body;

  try {
    const result = await gateway.transaction.sale({
      amount: String(amount),
      paymentMethodNonce,
      deviceData,
      options: {
        submitForSettlement: true, // set false to authorize-only
      },
    });

    const tx = result.transaction;

    if (!result.success) {
      return res.status(400).json({
        success: false,
        status: tx?.status,
        processorResponseCode: tx?.processorResponseCode,
        processorResponseText: tx?.processorResponseText,
      });
    }

    return res.json({
      success: true,
      id: tx.id,
      status: tx.status,
      amount: tx.amount,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Transaction error' });
  }
});

export default router;
```

## Authorize only, then capture later

```javascript
const auth = await gateway.transaction.sale({
  amount: '50.00',
  paymentMethodNonce,
  options: { submitForSettlement: false },
});

if (auth.success) {
  await gateway.transaction.submitForSettlement(auth.transaction.id);
}
```

## Void (unsettled)

```javascript
const voidResult = await gateway.transaction.void('transaction_id_here');
```

## Refund (settled or settling)

```javascript
const refundResult = await gateway.transaction.refund('transaction_id_here', '25.00'); // partial
// or full refund: omit amount per Braintree API rules
```

## `submitForSettlement` on existing authorization

```javascript
await gateway.transaction.submitForSettlement('authorized_transaction_id', '50.00');
```

## Status handling (common cases)

| Situation | Typical `transaction.status` / outcome |
|-----------|------------------------------------------|
| Auth succeeded, not captured | `authorized` |
| Captured / submitted for settlement | `submitted_for_settlement`, then `settling` / `settled` |
| Processor decline | `processor_declined` — check `processorResponseCode` (often 2000–3000 range) |
| Gateway / risk decline | `gateway_rejected` — check `gatewayRejectionReason` |
| Validation | Errors on `result.errors` / `ValidationErrorCollection` before a `transaction` exists |

Always branch on **`result.success`** first, then inspect **`transaction.status`**, **`processorResponseCode`**, and **`gatewayRejectionReason`**.

## `deviceData`

Pass **`deviceData`** from the client (Drop-in `requestPaymentMethod`, or `braintree.dataCollector`) into `transaction.sale({ deviceData })` to improve fraud signals.
