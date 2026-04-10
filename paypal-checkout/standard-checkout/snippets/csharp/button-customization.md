# Button customization — PayPal JS SDK v5 and v6

Customize **shape**, **color**, **label**, **height**, and **layout** for Smart Payment Buttons (v5) and the analogous options in v6 (names follow the SDK version you load).

## v5 — `paypal.Buttons({ style: { ... } })`

```javascript
paypal.Buttons({
  style: {
    layout: 'vertical',   // 'vertical' | 'horizontal'
    color: 'gold',      // 'gold' | 'blue' | 'silver' | 'white' | 'black'
    shape: 'rect',      // 'rect' | 'pill'
    label: 'paypal',    // 'paypal' | 'checkout' | 'buynow' | 'pay' | 'installment'
    height: 45,         // 25–55
    tagline: false
  },
  createOrder: async function () { /* ... */ },
  onApprove: async function (data) { /* ... */ }
}).render('#paypal-button-container');
```

### Per-funding styling

When rendering multiple buttons (e.g. PayPal vs Venmo), pass `style` on each `paypal.Buttons({ ... })` instance.

### Disable cards (wallet only)

```html
<script src="https://www.paypal.com/sdk/js?client-id=YOUR_CLIENT_ID&disable-funding=card"></script>
```

## v6 — Session / button options

v6 uses a different entry point (`createInstance`, render helpers). Set **branding** and **button appearance** on the object that creates the button or session (exact property names depend on SDK version):

```javascript
// Illustrative — confirm property names in PayPal Web SDK v6 reference.
const sdk = await paypal.createInstance({ clientId, clientToken });
await sdk.createPayPalOneTimePaymentButton({
  fundingSource: paypal.FUNDING.PAYPAL,
  style: {
    shape: 'rect',
    color: 'gold',
    layout: 'vertical'
  },
  paymentSession: checkoutSession
}).render('#paypal-buttons-container');
```

## Brand guidelines

- Follow [PayPal brand guidelines](https://www.paypal.com/us/brc/) for colors, clear space, and wording.
- Do not obscure the PayPal logo or mimic official assets incorrectly.

## A11y

- Use a visible, keyboard-focusable container (`#paypal-button-container`) and avoid overlapping elements that block the iframe.

## Server impact

Button styling is **client-only**. Your ASP.NET **create** and **capture** routes do not change.
