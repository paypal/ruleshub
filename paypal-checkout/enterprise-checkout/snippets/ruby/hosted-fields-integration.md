# Braintree Hosted Fields — client JS (with Sinatra)

Hosted Fields render PCI-compliant card inputs in iframes while you control layout. Pair with a server-generated **client token** and **`braintree.hostedFields.create`**.

## HTML shell (ERB fragment)

```erb
<form id="card-form" action="/api/braintree/charge" method="post">
  <label>Card number</label>
  <div id="card-number" class="hosted-field"></div>

  <label>Expiration</label>
  <div class="hosted-field" style="display:flex;gap:8px;">
    <div id="expiration-month"></div>
    <div id="expiration-year"></div>
  </div>

  <label>CVV</label>
  <div id="cvv"></div>

  <input type="hidden" name="payment_method_nonce" id="payment-method-nonce" />
  <button type="submit" id="submit">Pay</button>
</form>

<script src="https://js.braintreegateway.com/web/3.97.1/js/client.min.js"></script>
<script src="https://js.braintreegateway.com/web/3.97.1/js/hosted-fields.min.js"></script>
```

## Client JS — tokenize to nonce, then POST JSON to Sinatra

```javascript
(async function () {
  const tokenRes = await fetch('/api/braintree/client-token');
  const { clientToken } = await tokenRes.json();

  const clientInstance = await braintree.client.create({ authorization: clientToken });

  const hostedFieldsInstance = await braintree.hostedFields.create({
    client: clientInstance,
    styles: {
      input: { 'font-size': '16px', color: '#333' },
      '.invalid': { color: '#c00' }
    },
    fields: {
      number: { selector: '#card-number', placeholder: '4111 1111 1111 1111' },
      expirationMonth: { selector: '#expiration-month', placeholder: 'MM' },
      expirationYear: { selector: '#expiration-year', placeholder: 'YYYY' },
      cvv: { selector: '#cvv', placeholder: '123' }
    }
  });

  document.getElementById('card-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const { nonce, details } = await hostedFieldsInstance.tokenize();
    const res = await fetch('/api/braintree/charge', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        paymentMethodNonce: nonce,
        amount: '10.00',
        lastTwo: details && details.lastTwo
      })
    });
    if (!res.ok) throw new Error(await res.text());
  });
})();
```

## Sinatra server

- **`GET /api/braintree/client-token`** — see `braintree-client-token.md`.
- **`POST /api/braintree/charge`** — parse JSON and call `gateway.transaction.sale` — see `braintree-transaction.md`.

## Rails notes

- Use **`form_with url: ... local: true`** only if you post nonces through a traditional form; JSON APIs match the pattern above with **`fetch`** or **Turbo**.
- Keep Braintree script URLs version-pinned; update when upgrading the client SDK.

## Related snippets

- `braintree-client-token.md`
- `braintree-transaction.md`
- `braintree-3d-secure.md` — add `threeDSecure` component for liability shift
