# Braintree client token — server (Express) + notes

Generate a **client token** on your server with `gateway.clientToken.generate()`. The Braintree browser SDK uses it to initialize `braintree.client` (Drop-in, Hosted Fields, 3D Secure, etc.).

## Gateway setup

```javascript
// server/braintree-gateway.js
import braintree from 'braintree';

export function createBraintreeGateway() {
  return new braintree.BraintreeGateway({
    environment:
      process.env.BRAINTREE_ENVIRONMENT === 'Production'
        ? braintree.Environment.Production
        : braintree.Environment.Sandbox,
    merchantId: process.env.BRAINTREE_MERCHANT_ID,
    publicKey: process.env.BRAINTREE_PUBLIC_KEY,
    privateKey: process.env.BRAINTREE_PRIVATE_KEY,
  });
}
```

## Express: GET `/api/braintree/client-token`

```javascript
// server/routes/client-token.js
import { Router } from 'express';
import { createBraintreeGateway } from '../braintree-gateway.js';

const router = Router();
const gateway = createBraintreeGateway();

/**
 * Optional query: customerId — for returning users with vaulted methods.
 * Never trust client-supplied IDs without your own session/auth mapping.
 */
router.get('/api/braintree/client-token', async (req, res) => {
  try {
    const customerId = req.query.customerId; // optional

    const result = await gateway.clientToken.generate(
      customerId ? { customerId: String(customerId) } : {}
    );

    res.json({ clientToken: result.clientToken });
  } catch (err) {
    console.error('clientToken.generate failed', err);
    res.status(500).json({ error: 'Could not create client token' });
  }
});

export default router;
```

### Returning users (`customerId`)

Pass `customerId` when the buyer already has a Braintree **customer** record so the client can show vaulted payment methods (e.g. Drop-in with vaulted cards).

```javascript
await gateway.clientToken.generate({ customerId: 'braintree_customer_123' });
```

## Token lifetime and caching

- Client tokens are short-lived (commonly cited **~24 hours** in Braintree docs). Treat them as **single-session** credentials.
- **Do not** cache one token and reuse it across different users or browsers — each response should be for the **current** authenticated session.
- Regenerate on full page load or when switching customers.

## Client usage (next step)

Fetch `GET /api/braintree/client-token` (or with `?customerId=`), then pass `clientToken` / `authorization` into `braintree.dropin.create`, `braintree.client.create`, etc.

See `drop-in-ui-integration.md` and `hosted-fields-integration.md`.
