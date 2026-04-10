# 3D Secure — Expanded Checkout (PHP backend + JS client)

For card payments in regulated regions, **SCA** may be required. With **Card Fields**, the JS SDK typically orchestrates the **3DS** challenge when **`payment_source.card.attributes.verification.method`** is set to **`SCA_WHEN_REQUIRED`** or **`SCA_ALWAYS`** on **create order** (see `create-order.md`).

Your **PHP** server still:

1. Creates the order with **`payment_source.card`** (not deprecated `application_context`).
2. Lets the client complete authentication via the SDK.
3. Captures when the order reaches an approvable state (`capture-order.md`).

## Server: verification method on create order

Use **`SCA_WHEN_REQUIRED`** unless your policy requires **`SCA_ALWAYS`**:

```php
'payment_source' => [
    'card' => [
        'experience_context' => [
            'return_url' => 'https://yoursite.com/paypal/return',
            'cancel_url' => 'https://yoursite.com/paypal/cancel',
        ],
        'attributes' => [
            'verification' => [
                'method' => 'SCA_WHEN_REQUIRED',
            ],
        ],
    ],
],
```

## Client: let the SDK drive the flow

- After **`createOrder`** returns an `orderID`, the Card Fields SDK continues the payer interaction; if 3DS is required, the SDK shows the challenge or redirect experience per current **JS SDK** behavior.
- Do **not** try to collect OTP codes in your own forms.

## Return URL handling

If the flow returns to **`return_url`**, load your checkout page and:

1. Resume or poll order status if your integration requires it.
2. Call **capture** from the server when appropriate (often after `onApprove` from the SDK — follow the SDK event model you implement in `card-fields-integration.md`).

## Inspecting results after capture

After **POST** `/v2/checkout/orders/{id}/capture`, inspect the order JSON for **authentication** and **liability** fields (see `capture-order.md`). Use **`paypal-debug-id`** for support.

## Testing (sandbox)

- Use PayPal **negative testing** and **sandbox card** numbers documented for 3DS scenarios.
- [3D Secure (developer.paypal.com)](https://developer.paypal.com/docs/checkout/advanced/customize/3d-secure/)
- [3DS with JS SDK v6 (docs.paypal.ai)](https://docs.paypal.ai/payments/methods/cards/3ds)

## Common issues

| Symptom | Check |
|---------|--------|
| No 3DS when expected | Region/card; `SCA_ALWAYS` vs `SCA_WHEN_REQUIRED`; issuer behavior |
| Capture fails after challenge | Order state; capture only after SDK `onApprove` / completed contingency |
| Wrong URLs | `payment_source.card.experience_context.return_url` / `cancel_url` must be HTTPS in production |
