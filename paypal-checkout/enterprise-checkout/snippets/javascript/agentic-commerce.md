# Agentic commerce / Store Sync — Cart API, orders, checkout completion

## Store Sync (overview)

**Store Sync** connects your catalog and inventory to PayPal so **AI agents** (and compatible surfaces) can discover products, respect availability, and drive discovery-to-purchase flows. You maintain product data; PayPal/agentic layers use it for **agentic commerce** experiences. Pair Store Sync with **Cart API** so the buyer’s selections are represented server-side before checkout.

## Cart API + checkout

**Cart API** models carts on PayPal (`/v2/cart`). Typical flow: **create cart** → **read/update** lines and context → **convert to a payable checkout** by mapping the cart to **Orders API v2** (PayPal wallet) or completing a **Braintree** card flow on your site.

REST bases: Sandbox `https://api-m.sandbox.paypal.com`, Production `https://api-m.paypal.com`.

## OAuth (reuse)

Use the same **`client_credentials`** token as other REST calls (`getPayPalAccessToken` in `seller-onboarding.md`).

## Cart API

### `POST /v2/cart` — create

```javascript
import axios from 'axios';
import { getPayPalAccessToken } from './paypal-auth.js';

const PAYPAL_BASE =
  process.env.PAYPAL_ENVIRONMENT === 'production'
    ? 'https://api-m.paypal.com'
    : 'https://api-m.sandbox.paypal.com';

export async function createCart(payload) {
  const accessToken = await getPayPalAccessToken();
  const { data } = await axios.post(`${PAYPAL_BASE}/v2/cart`, payload, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      'PayPal-Request-Id': crypto.randomUUID(),
    },
  });
  return data;
}
```

Example minimal payload shape (align with current Cart API schema in developer reference):

```javascript
await createCart({
  // intent, items, payee, experience_context, etc. per docs
});
```

### `GET /v2/cart/{cart_id}` — details

```javascript
export async function getCart(cartId) {
  const accessToken = await getPayPalAccessToken();
  const { data } = await axios.get(
    `${PAYPAL_BASE}/v2/cart/${encodeURIComponent(cartId)}`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  return data;
}
```

### `PATCH /v2/cart/{cart_id}` — update lines / context

```javascript
export async function patchCart(cartId, patchBody) {
  const accessToken = await getPayPalAccessToken();
  const { data } = await axios.patch(
    `${PAYPAL_BASE}/v2/cart/${encodeURIComponent(cartId)}`,
    patchBody,
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

## Convert cart to order / complete checkout

1. **Orders v2 (PayPal)** — Build **`POST /v2/checkout/orders`** from cart line items and totals (same currency and amounts as the cart). For marketplaces, include **`payee.merchant_id`**, **`payment_instruction.platform_fees`**, **`payment_source.paypal.experience_context`**, and **`PayPal-Auth-Assertion`** per `multiparty-create-order.md`. Approve with the JS SDK, then **`POST /v2/checkout/orders/{id}/capture`** (`multiparty-capture.md`).
2. **Cart-native completion** — Where your program uses PayPal’s **Complete Checkout** (or equivalent cart completion endpoint in current docs), call it with the **cart id** (and any required payment context) **after** buyer approval, per the published request schema.
3. **Braintree path** — Card / Drop-in / Hosted Fields: tokenize on the client, send nonce to the server, then **`gateway.transaction.sale`** (`braintree-transaction.md`); vault returning buyers with **`customerId`** + tokens (`braintree-vault.md`). Cart amounts must match the **`transaction.sale`** amount.

Keep **one source of truth** for amounts: sync cart line items with what you send to Orders or Braintree to avoid reconciliation errors.

## Agent discovery

Agents use **Store Sync** catalog endpoints and your **merchant-configured** agentic surfaces; carts created via API let the buyer finish in PayPal checkout or your web app depending on integration.
