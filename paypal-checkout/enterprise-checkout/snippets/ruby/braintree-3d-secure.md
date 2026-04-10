# Braintree 3D Secure — client JS + server `three_d_secure_info`

Use **3DS** for liability shift on eligible cards. **Drop-in** and **Hosted Fields** can request 3DS via **`threeDSecure`** options; the server reads **`three_d_secure_info`** on the created transaction.

## Client — Drop-in (see `drop-in-ui-integration.md`)

Enable 3DS on Drop-in and pass amount when requesting the payment method:

```javascript
const payload = await dropinInstance.requestPaymentMethod({
  threeDSecure: { amount: '10.00' }
});
// payload.nonce — send to server
```

## Client — Hosted Fields + `threeDSecure` component

For Hosted Fields, add **`braintree.threeDSecure`** after **`braintree.client.create`**, verify the nonce with **`verifyCard`**, then POST the verified nonce to your server.

```html
<script src="https://js.braintreegateway.com/web/3.97.1/js/client.min.js"></script>
<script src="https://js.braintreegateway.com/web/3.97.1/js/hosted-fields.min.js"></script>
<script src="https://js.braintreegateway.com/web/3.97.1/js/three-d-secure.min.js"></script>
```

```javascript
(async function () {
  const { clientToken } = await (await fetch('/api/braintree/client-token')).json();
  const clientInstance = await braintree.client.create({ authorization: clientToken });

  const hostedFieldsInstance = await braintree.hostedFields.create({ /* fields... */ client: clientInstance });

  const threeDSecureInstance = await braintree.threeDSecure.create({
    client: clientInstance,
    version: 2
  });

  document.getElementById('card-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const { nonce } = await hostedFieldsInstance.tokenize();

    const verifyPayload = await threeDSecureInstance.verifyCard({
      amount: '10.00',
      nonce: nonce,
      bin: hostedFieldsInstance.getState().cards[0].bin // or collect BIN per Braintree docs
    });

    await fetch('/api/braintree/charge', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ paymentMethodNonce: verifyPayload.nonce, amount: '10.00' })
    });
  });
})();
```

Adjust **`verifyCard`** parameters to match the [Braintree 3D Secure guide](https://developer.paypal.com/braintree/docs/guides/3d-secure/) for your SDK version.

## Server — `transaction.sale` then inspect 3DS outcome

```ruby
# frozen_string_literal: true

result = braintree_gateway.transaction.sale(
  amount: "10.00",
  payment_method_nonce: nonce_from_client,
  options: { submit_for_settlement: true }
)

if result.success?
  txn = result.transaction
  tds = txn.three_d_secure_info

  if tds
    status = tds.status           # e.g. authenticate_success, authenticate_attempt_success, authenticate_rejected
    liability = tds.liability_shifted
    enrolled = tds.enrolled
    # log for risk / support; map to buyer-safe messaging on failure paths
  end
else
  # error-handling.md
end
```

Fields available depend on card network and 3DS version; always branch on **`result.success?`** first.

## Rails notes

- Keep 3DS **amount** in sync with the order total on client and server.
- Log **`transaction.id`** and 3DS **status** without logging full PAN data.

## Related snippets

- `hosted-fields-integration.md`
- `drop-in-ui-integration.md`
- `braintree-transaction.md`
- `error-handling.md`
