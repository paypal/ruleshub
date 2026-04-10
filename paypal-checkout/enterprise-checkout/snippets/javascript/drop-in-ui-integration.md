# Braintree Drop-in UI — vanilla JS client

Drop-in bundles card fields and optional PayPal, Venmo, Apple Pay, and Google Pay in one UI. Load Braintree JS from the CDN, fetch a **client token** from your server, then call `braintree.dropin.create`.

## HTML shell

```html
<div id="dropin-container"></div>
<button id="pay-button" type="button">Pay</button>
<script src="https://js.braintreegateway.com/web/dropin/1.45.0/js/dropin.min.js"></script>
<script type="module" src="/js/dropin-checkout.js"></script>
```

## Client: create Drop-in, wallets, events, nonce to server

```javascript
// public/js/dropin-checkout.js

const clientToken = await fetch('/api/braintree/client-token')
  .then((r) => r.json())
  .then((d) => d.clientToken);

const dropinInstance = await braintree.dropin.create({
  authorization: clientToken,
  container: '#dropin-container',
  threeDSecure: true, // if using 3DS; see braintree-3d-secure.md
  paypal: {
    flow: 'vault', // or 'checkout'
  },
  venmo: {},
  applePay: {
    displayName: 'My Store',
    paymentRequest: {
      total: { label: 'My Store', amount: '10.00' },
      requiredBillingContactFields: ['postalAddress'],
    },
  },
  googlePay: {
    googlePayVersion: 2,
    merchantId: 'merchant-id-from-google', // from Google Pay setup
    transactionInfo: {
      totalPriceStatus: 'FINAL',
      totalPrice: '10.00',
      currencyCode: 'USD',
    },
  },
});

dropinInstance.on('paymentMethodRequestable', (payload) => {
  console.log('Payment method ready', payload.type);
});

dropinInstance.on('noPaymentMethodRequestable', () => {
  console.log('No payment method selected');
});

document.getElementById('pay-button').addEventListener('click', async () => {
  try {
    const payload = await dropinInstance.requestPaymentMethod({
      threeDSecure: {
        amount: '10.00',
        // billingAddress: { ... } // if required for 3DS
      },
    });

    const nonce = payload.nonce;
    const deviceData = payload.deviceData; // if collected by Drop-in

    const res = await fetch('/api/braintree/charge', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        paymentMethodNonce: nonce,
        amount: '10.00',
        deviceData,
      }),
    });

    if (!res.ok) throw new Error(await res.text());
    const result = await res.json();
    console.log('Server result', result);
  } catch (err) {
    console.error(err);
    alert('Payment failed');
  }
});
```

## Notes

- **PayPal / Venmo / Apple Pay / Google Pay** blocks depend on browser capability, merchant configuration, and Braintree dashboard settings.
- **`requestPaymentMethod()`** returns a **nonce** (one-time use). Send it to your server; the server runs `gateway.transaction.sale` (see `braintree-transaction.md`).
- **Events**: `paymentMethodRequestable`, `noPaymentMethodRequestable`, `paymentOptionSelected` (use Braintree Drop-in docs for full list).
- **3D Secure**: enable `threeDSecure: true` in `create` options and pass `threeDSecure` in `requestPaymentMethod` when required.
