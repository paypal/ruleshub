# Multiparty create order — `experience_context`, platform fees, Auth-Assertion

Create a **PayPal** order where the **seller** is the payee and the **platform** takes a fee. Use **`payment_source.paypal.experience_context`** for locale, brand, shipping, etc. **Do not** use deprecated top-level `application_context` for new integrations.

Use **`PayPal-Auth-Assertion`** (JWT) so PayPal knows the partner is acting for the seller.

## Build Auth-Assertion JWT (header value)

The **`PayPal-Auth-Assertion`** header carries a **signed JWT** (three Base64URL-encoded segments: `header.payload.signature`). Claims must include (at minimum) **`iss`** = partner REST **client_id** and **`payer_id`** = **seller merchant id**. Generate per PayPal multiparty docs (algorithm and key material from your partner app).

```text
PayPal-Auth-Assertion: eyJhbGciOi...<compact JWT string>...
```

Pass the **compact JWT string** as the header value (not JSON). Use PayPal’s official guide for exact signing requirements in your environment.

## `POST /v2/checkout/orders` (axios)

```javascript
import axios from 'axios';
import { getPayPalAccessToken } from './paypal-auth.js';

const PAYPAL_BASE =
  process.env.PAYPAL_ENVIRONMENT === 'production'
    ? 'https://api-m.paypal.com'
    : 'https://api-m.sandbox.paypal.com';

/**
 * authAssertionJwt: signed JWT per PayPal multiparty (iss=partner client_id, payer_id=seller_merchant_id)
 */
export async function createMultipartyOrder({
  sellerMerchantId,
  platformFeeAmount,
  itemTotal,
  currencyCode = 'USD',
  authAssertionJwt,
}) {
  const accessToken = await getPayPalAccessToken();

  const body = {
    intent: 'CAPTURE',
    purchase_units: [
      {
        reference_id: 'default',
        amount: {
          currency_code: currencyCode,
          value: itemTotal,
          breakdown: {
            item_total: { currency_code: currencyCode, value: itemTotal },
          },
        },
        payee: {
          merchant_id: sellerMerchantId,
        },
        payment_instruction: {
          // INSTANT: funds move per PayPal schedule; DELAYED: platform-controlled release (marketplace)
          disbursement_mode: 'INSTANT',
          platform_fees: [
            {
              amount: { currency_code: currencyCode, value: platformFeeAmount },
            },
          ],
        },
      },
    ],
    payment_source: {
      paypal: {
        experience_context: {
          payment_method_preference: 'IMMEDIATE_PAYMENT_REQUIRED',
          brand_name: 'My Marketplace',
          locale: 'en-US',
          landing_page: 'LOGIN',
          user_action: 'PAY_NOW',
          return_url: 'https://yourplatform.com/paypal/return',
          cancel_url: 'https://yourplatform.com/paypal/cancel',
          shipping_preference: 'GET_FROM_FILE',
        },
      },
    },
  };

  const { data } = await axios.post(`${PAYPAL_BASE}/v2/checkout/orders`, body, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      'PayPal-Partner-Attribution-Id': 'PARTNER_BN_CODE', // optional BN code
      'PayPal-Auth-Assertion': authAssertionJwt,
    },
  });

  return data;
}
```

## Disbursement modes (`payment_instruction.disbursement_mode`)

| Value | Typical use |
|-------|-------------|
| **`INSTANT`** | Default; disbursement follows PayPal’s standard timing for the transaction. |
| **`DELAYED`** | Marketplace / platform holds release (e.g. escrow-style); confirm eligibility and seller setup with current PayPal multiparty docs. |

Set **`disbursement_mode`** alongside **`platform_fees`** under the same **`purchase_units[].payment_instruction`** object. Wrong mode for your integration can block capture or settlement.

## Important

- **`purchase_units[].payee.merchant_id`**: seller (connected) merchant id.
- **`payment_instruction.platform_fees`**: platform cut; currency must match the transaction currency.
- **`payment_source.paypal.experience_context`**: use for locale, return/cancel URLs, shipping, and UX — **not** deprecated top-level **`application_context`** for new integrations.
- **`PayPal-Auth-Assertion`**: required for partner-initiated seller transactions per multiparty documentation.

Approve and capture on the client with the JS SDK using the returned `id`, then capture on the server (see `multiparty-capture.md`).
