# Multiparty capture and refunds — Auth-Assertion, fee split, platform fee refund

**Capture** the approved order with **`POST /v2/checkout/orders/{order_id}/capture`** and the same **`PayPal-Auth-Assertion`** pattern used at create time. The response shows **seller/platform split**. **Refunds** can include **`payment_instruction.platform_fees`** to refund part of the platform fee.

## Capture order

```javascript
import axios from 'axios';
import { getPayPalAccessToken } from './paypal-auth.js';

const PAYPAL_BASE =
  process.env.PAYPAL_ENVIRONMENT === 'production'
    ? 'https://api-m.paypal.com'
    : 'https://api-m.sandbox.paypal.com';

export async function captureMultipartyOrder(orderId, authAssertionJwt) {
  const accessToken = await getPayPalAccessToken();

  const { data } = await axios.post(
    `${PAYPAL_BASE}/v2/checkout/orders/${encodeURIComponent(orderId)}/capture`,
    {},
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'PayPal-Auth-Assertion': authAssertionJwt,
      },
    }
  );

  // Inspect purchase_units[].payments.captures[] for amounts and seller receivable vs platform fee
  return data;
}
```

### Fee split (response)

Parse **`purchase_units[0].payments.captures[0].seller_receivable_breakdown`** (and related fields) per Orders API v2 schema for your logging and reconciliation.

## Refund capture with platform fee component

```javascript
export async function refundCaptureWithPlatformFee({
  captureId,
  amount, // total refund amount
  platformFeeRefund, // portion attributed to platform fee refund
  currencyCode = 'USD',
  authAssertionJwt,
}) {
  const accessToken = await getPayPalAccessToken();

  const body = {
    amount: {
      currency_code: currencyCode,
      value: amount,
    },
    payment_instruction: {
      platform_fees: [
        {
          amount: {
            currency_code: currencyCode,
            value: platformFeeRefund,
          },
        },
      ],
    },
  };

  const { data } = await axios.post(
    `${PAYPAL_BASE}/v2/payments/captures/${encodeURIComponent(captureId)}/refund`,
    body,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'PayPal-Auth-Assertion': authAssertionJwt,
      },
    }
  );

  return data;
}
```

Align **`platform_fees`** amounts with PayPal multiparty refund rules (currency match, eligible captures). Consult current API reference for optional fields (invoice id, note to payer).
