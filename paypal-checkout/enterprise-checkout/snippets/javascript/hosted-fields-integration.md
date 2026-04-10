# Braintree Hosted Fields — vanilla JS client

Hosted Fields keep raw card data out of your DOM: iframes handle PAN, expiry, CVV, and postal code. Flow: fetch client token → `braintree.client.create` → `braintree.hostedFields.create` → `tokenize()` → send nonce to server.

## HTML

```html
<form id="payment-form">
  <label>Card number</label>
  <div id="card-number" class="hf-field"></div>
  <label>Expiration</label>
  <div id="expiration-date" class="hf-field"></div>
  <label>CVV</label>
  <div id="cvv" class="hf-field"></div>
  <label>Postal code</label>
  <div id="postal-code" class="hf-field"></div>
  <button type="submit">Pay</button>
</form>
<script src="https://js.braintreegateway.com/web/3.112.0/js/client.min.js"></script>
<script src="https://js.braintreegateway.com/web/3.112.0/js/hosted-fields.min.js"></script>
<script src="https://js.braintreegateway.com/web/3.112.0/js/data-collector.min.js"></script>
<script type="module" src="/js/hosted-fields-checkout.js"></script>
```

## Client: client → hostedFields → styles, events, tokenize

```javascript
// public/js/hosted-fields-checkout.js

const clientToken = await fetch('/api/braintree/client-token')
  .then((r) => r.json())
  .then((d) => d.clientToken);

const clientInstance = await braintree.client.create({
  authorization: clientToken,
});

const style = {
  input: {
    'font-size': '16px',
    color: '#333',
  },
  '::placeholder': {
    color: '#999',
  },
  '.invalid': {
    color: '#c00',
  },
};

const hostedFieldsInstance = await braintree.hostedFields.create({
  client: clientInstance,
  styles: {
    input: style.input,
    '::placeholder': style['::placeholder'],
    '.invalid': style['.invalid'],
  },
  fields: {
    number: { selector: '#card-number', placeholder: '4111 1111 1111 1111' },
    expirationDate: { selector: '#expiration-date', placeholder: 'MM / YY' },
    cvv: { selector: '#cvv', placeholder: '123' },
    postalCode: { selector: '#postal-code', placeholder: '94107' },
  },
});

hostedFieldsInstance.on('validityChange', (event) => {
  const field = event.fields[event.emittedBy];
  console.log(event.emittedBy, 'isValid:', field.isValid);
});

hostedFieldsInstance.on('cardTypeChange', (event) => {
  if (event.cards.length === 1) {
    console.log('Card type', event.cards[0].type);
  } else {
    console.log('Unknown or multiple card types');
  }
});

document.getElementById('payment-form').addEventListener('submit', async (e) => {
  e.preventDefault();

  try {
    const { nonce, details } = await hostedFieldsInstance.tokenize();
    const deviceData = await braintree.dataCollector
      .create({ client: clientInstance })
      .then((dc) => dc.deviceData)
      .catch(() => undefined);

    const res = await fetch('/api/braintree/charge', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        paymentMethodNonce: nonce,
        amount: '10.00',
        deviceData,
        lastTwo: details?.lastTwo,
      }),
    });

    if (!res.ok) throw new Error(await res.text());
    console.log(await res.json());
  } catch (err) {
    console.error('tokenize or charge failed', err);
  }
});
```

## Styling tips

- Match `font-size`, `line-height`, and `font-family` to your form for visual alignment.
- Use the `.invalid` class in `styles` and listen to `validityChange` for inline errors.
- Hosted Fields are iframes — parent page CSS does not pierce the fields; use the `styles` object.

## Server

Send `paymentMethodNonce` to your Express route and run `gateway.transaction.sale` (see `braintree-transaction.md`).
