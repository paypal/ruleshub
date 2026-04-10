# 3D Secure — Expanded Checkout (ASP.NET Core + JS SDK)

**3D Secure / SCA** is driven by issuer rules and regional requirements (e.g. PSD2). With **Card Fields**, the JS SDK can trigger authentication when required. Your server should create orders with **`payment_source.card`** and a verification method such as **`SCA_WHEN_REQUIRED`** (see **create-order.md**).

## Server responsibilities

1. **Create order** with `payment_source.card.attributes.verification.method` = `SCA_WHEN_REQUIRED` (or `SCA_ALWAYS` if required by your policy).
2. **Capture** after the SDK completes the payer flow; no separate “finish 3DS” server call for the standard Orders v2 Card Fields path — the approval step accounts for challenges.
3. **Parse** capture response for authentication outcomes (**`liability_shift`**, etc.) — see **capture-order.md**.

## Client responsibilities

- Use **JS SDK v6** with **`card-fields`** (see **sdk-initialization.md**).
- Implement **`createOrder`** / **`onApprove`** (or equivalent) so the hosted fields flow can complete 3DS when the SDK presents it.
- Handle **user abandonment** (close modal, timeout) and surface **retry** UX.

## Example: verification method in create payload (reminder)

```json
{
  "intent": "CAPTURE",
  "purchase_units": [...],
  "payment_source": {
    "card": {
      "attributes": {
        "verification": {
          "method": "SCA_WHEN_REQUIRED"
        }
      }
    }
  }
}
```

## Testing

- Use PayPal **Sandbox** cards and negative testing where applicable: [Sandbox testing](https://developer.paypal.com/tools/sandbox/).
- Log **`PayPal-Debug-Id`** from failed API responses for support.

## REST hosts

- Sandbox: `https://api-m.sandbox.paypal.com`
- Production: `https://api-m.paypal.com`

## Docs

- [3D Secure (developer.paypal.com)](https://developer.paypal.com/docs/checkout/advanced/customize/3d-secure/)
- [3DS with JS SDK v6 (docs.paypal.ai)](https://docs.paypal.ai/payments/methods/cards/3ds)
