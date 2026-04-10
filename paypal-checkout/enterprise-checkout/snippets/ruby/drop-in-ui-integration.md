# Braintree Drop-in UI — Sinatra ERB + client JS

Drop-in bundles card fields and optional PayPal, Venmo, Apple Pay, and Google Pay. Server provides a **client token** (see `braintree-client-token.md`); the page loads Braintree JS from the CDN and calls `braintree.dropin.create`.

## Sinatra — route + ERB

```ruby
# frozen_string_literal: true

require "sinatra"

get "/checkout" do
  erb :checkout
end
```

## `views/checkout.erb`

```erb
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>Checkout</title>
  <script src="https://js.braintreegateway.com/web/dropin/1.45.0/js/dropin.min.js"></script>
</head>
<body>
  <div id="dropin-container"></div>
  <button id="pay-button" type="button">Pay</button>

  <script>
    (async function () {
      const res = await fetch('/api/braintree/client-token');
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'client token failed');

      const clientToken = data.clientToken;

      const dropinInstance = await braintree.dropin.create({
        authorization: clientToken,
        container: '#dropin-container',
        threeDSecure: true,
        paypal: { flow: 'vault' },
        venmo: {},
        applePay: {
          displayName: 'My Store',
          paymentRequest: {
            total: { label: 'My Store', amount: '10.00' },
            requiredBillingContactFields: ['postalAddress']
          }
        },
        googlePay: {
          googlePayVersion: 2,
          merchantId: 'merchant-id-from-google',
          transactionInfo: {
            totalPriceStatus: 'FINAL',
            totalPrice: '10.00',
            currencyCode: 'USD'
          }
        }
      });

      document.getElementById('pay-button').addEventListener('click', async () => {
        const payload = await dropinInstance.requestPaymentMethod({
          threeDSecure: { amount: '10.00' }
        });

        const charge = await fetch('/api/braintree/charge', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            paymentMethodNonce: payload.nonce,
            amount: '10.00',
            deviceData: payload.deviceData
          })
        });

        if (!charge.ok) throw new Error(await charge.text());
        const result = await charge.json();
        console.log('Success', result);
      });
    })();
  </script>
</body>
</html>
```

Implement **`POST /api/braintree/charge`** with `gateway.transaction.sale` — see `braintree-transaction.md`.

## Rails notes

- Place the template in **`app/views/checkout/show.html.erb`** and use **`javascript_include_tag`** or a build pipeline for Braintree scripts.
- Prefer **`content_security_policy`** to allow `js.braintreegateway.com` if you use CSP.
- Move inline scripts to **`app/javascript`** packs if using import maps or Webpack/Vite.

## Related snippets

- `braintree-client-token.md`
- `braintree-transaction.md`
- `braintree-3d-secure.md`
