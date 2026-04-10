# 3D Secure / SCA — Expanded Checkout (Card Fields)

3D Secure (3DS) provides **Strong Customer Authentication (SCA)** for card payments. With **JS SDK v6 Card Fields**, the challenge flow is typically **handled by the SDK** when the order and `verification.method` require it.

## How 3DS works with Card Fields

1. Client collects card via **hosted Card Fields** (not raw PAN in your inputs).
2. Server creates an order with **`payment_source.card.attributes.verification.method`** set.
3. Issuer decides if challenge is required — SDK/browser completes **challenge** when needed.
4. Server **captures** and reads **`authentication_result`** (including **liability_shift**).

## Orders API — `verification.method`

| Value | Behavior |
|-------|----------|
| `SCA_WHEN_REQUIRED` | Run 3DS when regulations/issuer require (common default). |
| `SCA_ALWAYS` | Request SCA whenever supported — may increase friction. |

Set on create order (server):

```javascript
payment_source: {
  card: {
    attributes: {
      verification: {
        method: 'SCA_WHEN_REQUIRED',
      },
    },
  },
},
```

## v6 SDK

Card Fields integration triggers 3DS **automatically** when required — avoid building custom redirects unless you use APIs that explicitly require them. Follow the current [3DS with JS SDK v6](https://docs.paypal.ai/payments/methods/cards/3ds) documentation.

## Capture response — `authentication_result`

After **POST** `/v2/checkout/orders/{id}/capture`, inspect:

- `payment_source.card.authentication_result.liability_shift`
- `payment_source.card.authentication_result.three_d_secure` (enrollment/status, when present)

```javascript
const liabilityShift = capture?.payment_source?.card?.authentication_result?.liability_shift;
const tds = capture?.payment_source?.card?.authentication_result?.three_d_secure;
```

## `liability_shift` values

| Value | Typical meaning |
|-------|-----------------|
| `YES` | Liability shifted to issuer; favorable for merchant. |
| `NO` | Not shifted; higher risk of chargeback loss — review policy. |
| `POSSIBLE` | May be treated as authenticated depending on network and region. |
| `UNKNOWN` | Outcome unclear — treat conservatively. |

Exact semantics can vary by network and region — always align with PayPal risk and your compliance team.

## Business logic — proceed vs reject

```javascript
function fulfillmentDecision({ liability_shift, orderValueCents, region }) {
  if (liability_shift === 'YES' || liability_shift === 'POSSIBLE') {
    return { fulfill: true, reason: 'AUTH_OK' };
  }
  if (liability_shift === 'NO') {
    return { fulfill: false, reason: 'NO_LIABILITY_SHIFT' };
  }
  if (liability_shift === 'UNKNOWN') {
    return { fulfill: false, reason: 'UNKNOWN_LIABILITY' };
  }
  return { fulfill: true, reason: 'NO_AUTH_DATA' };
}
```

- **Digital goods / high fraud:** tighten rules (e.g. do not fulfill on `NO`/`UNKNOWN`).
- **Low-value / low-risk:** align with your internal risk engine and PayPal guidance.

## Regional requirements

- **PSD2 (EU/EEA):** SCA often required for electronic payments; 3DS is the common path.
- **UK:** Similar SCA expectations post-Brexit for regulated flows.
- Always document **your** policy for cross-border sales and **MOTO** vs **ecommerce** distinctions.

## Common issues

| Issue | Resolution |
|-------|------------|
| Challenge loop or timeout | Check network/ad blockers; ensure popups not blocked if SDK uses them. |
| `AUTHENTICATION_FAILURE` | See `error-handling.md`; prompt another card or payment method. |
| Expected `YES` but got `NO` | Issuer/network decision — not a client bug; review method and region. |

## Best practices

- Default to **`SCA_WHEN_REQUIRED`** unless compliance mandates stricter behavior.
- Never fulfill **high-value** physical goods on `liability_shift: NO` without explicit risk acceptance.
- Log **PayPal-Debug-Id** on capture errors for issuer traceability.
