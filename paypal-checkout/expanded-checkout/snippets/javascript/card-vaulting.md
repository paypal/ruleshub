# Card Vaulting — Save Cards (Expanded Checkout)

Vaulting lets returning customers pay with a **saved card**. You can vault **with a purchase** (SDK) or **without a purchase** (Vault API). Always store **tokens** server-side with **encryption at rest** and tight access control.

## With purchase — `store_in_vault`

On order create, under **`payment_source.card.attributes.vault`**:

```javascript
payment_source: {
  card: {
    attributes: {
      vault: {
        store_in_vault: 'ON_SUCCESS',
      },
      verification: {
        method: 'SCA_WHEN_REQUIRED',
      },
    },
  },
},
```

`ON_SUCCESS` stores the payment method when the payment succeeds (capture/authorized per your flow).

## Without purchase — Vault API

| Method | Endpoint |
|--------|----------|
| POST | `/v3/vault/setup-tokens` |
| POST | `/v3/vault/payment-tokens` |

Base URL:

- Sandbox: `https://api-m.sandbox.paypal.com`
- Production: `https://api-m.paypal.com`

### Create setup token (server)

```javascript
import axios from 'axios';
import crypto from 'node:crypto';

async function createSetupToken(accessToken) {
  const { data } = await axios.post(
    `${PAYPAL_BASE_URL}/v3/vault/setup-tokens`,
    {
      payment_source: {
        card: {
          /* attributes as required by current Vault API — follow official schema */
        },
      },
    },
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'PayPal-Request-Id': crypto.randomUUID(),
      },
    }
  );
  return data;
}
```

> **Note:** The exact JSON body depends on whether the client completes Card Fields and passes a setup token id — follow [Vault API integration](https://docs.paypal.ai/payments/save/api/vault-api-integration) for the current request/response contract.

### Create payment token from setup token

```javascript
async function createPaymentToken(accessToken, setupTokenId) {
  const { data } = await axios.post(
    `${PAYPAL_BASE_URL}/v3/vault/payment-tokens`,
    {
      payment_source: {
        token: {
          id: setupTokenId,
          type: 'SETUP_TOKEN',
        },
      },
    },
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'PayPal-Request-Id': crypto.randomUUID(),
      },
    }
  );
  return data;
}
```

Align field names with the latest Orders/Vault schema (`SETUP_TOKEN` vs current enum).

## Pay with saved card — `vault_id`

When creating an order for a returning customer:

```javascript
payment_source: {
  card: {
    vault_id: 'SAVED_PAYMENT_TOKEN_ID',
  },
},
```

The **`vault_id`** is the stored **payment token** identifier from your system (mapped from PayPal’s token object).

## Webhook — `VAULT.PAYMENT-TOKEN.CREATED`

Subscribe in the dashboard and handle POST body verification (see `webhooks.md`).

```javascript
function handleVaultPaymentTokenCreated(event) {
  const resource = event?.resource;
  const tokenId = resource?.id;
  // Link tokenId to your customer record (encrypted), never log full PAN
  return { tokenId, customerId: resource?.customer?.id };
}
```

## Server-side token storage (encrypted)

```javascript
// Pseudocode — use your KMS / envelope encryption
import { createCipheriv, randomBytes, scryptSync } from 'node:crypto';

function encryptToken(plaintext, secret) {
  const iv = randomBytes(12);
  const key = scryptSync(secret, 'salt', 32);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const enc = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return { iv: iv.toString('base64'), tag: tag.toString('base64'), data: enc.toString('base64') };
}
```

- Store **ciphertext + IV + auth tag**; rotate keys.
- Restrict DB access; audit reads.

## Common issues

| Issue | Resolution |
|-------|------------|
| Token not created | Confirm `store_in_vault` and successful capture; check webhooks. |
| `vault_id` invalid | Token revoked or wrong environment; re-verify in vault dashboard. |
| PCI confusion | You still must not handle raw PAN; vault tokens are references. |

## Best practices

- Use **webhooks** plus **GET order** for reconciliation, not only client callbacks.
- Support **delete** flows and handle `VAULT.PAYMENT-TOKEN.DELETED`.
- Comply with **cardholder consent** for storing payment methods.
