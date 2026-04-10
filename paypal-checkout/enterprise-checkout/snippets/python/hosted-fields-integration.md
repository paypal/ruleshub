# Hosted Fields — client JS + Jinja2 (Braintree Direct)

**Hosted Fields** keep card data in Braintree-hosted iframes. Flow: load **`client_token`** → **`braintree.client.create`** → **`braintree.hostedFields.create`** with **fields**, **styles**, and **`tokenize`** on submit → send **nonce** to Flask (same server pattern as Drop-in).

## Flask — render template with `client_token`

```python
from flask import render_template

@app.get("/checkout/hosted-fields")
def hosted_fields_checkout():
    gw = braintree_gateway()
    token = gw.client_token.generate()
    return render_template("hosted_fields.html", client_token=token)
```

## HTML placeholders

```html
<form id="payment-form">
  <label>Card number</label>
  <div id="card-number" class="hosted-field"></div>
  <label>Expiration</label>
  <div id="expiration-date" class="hosted-field"></div>
  <label>CVV</label>
  <div id="cvv" class="hosted-field"></div>
  <button type="submit">Pay</button>
</form>

<script src="https://js.braintreegateway.com/web/3.112.0/js/client.min.js"></script>
<script src="https://js.braintreegateway.com/web/3.112.0/js/hosted-fields.min.js"></script>
```

## Client JS — create client, hosted fields, styles, tokenize

```javascript
const clientToken = {{ client_token|tojson }};

braintree.client.create({ authorization: clientToken }, (clientErr, clientInstance) => {
  if (clientErr) {
    console.error(clientErr);
    return;
  }

  braintree.hostedFields.create(
    {
      client: clientInstance,
      styles: {
        input: { "font-size": "16px", color: "#333" },
        "::placeholder": { color: "#999" },
        ".invalid": { color: "#c00" },
      },
      fields: {
        number: { selector: "#card-number", placeholder: "4111 1111 1111 1111" },
        expirationDate: { selector: "#expiration-date", placeholder: "MM / YY" },
        cvv: { selector: "#cvv", placeholder: "123" },
      },
    },
    (hfErr, hostedFieldsInstance) => {
      if (hfErr) {
        console.error(hfErr);
        return;
      }

      document.querySelector("#payment-form").addEventListener("submit", (ev) => {
        ev.preventDefault();
        hostedFieldsInstance.tokenize((tokenizeErr, payload) => {
          if (tokenizeErr) {
            console.error(tokenizeErr);
            return;
          }
          fetch("/api/braintree/checkout", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ payment_method_nonce: payload.nonce }),
          })
            .then((r) => r.json())
            .then(console.log)
            .catch(console.error);
        });
      });
    }
  );
});
```

## Flask

Serve a page that injects **`client_token`** (see `drop-in-ui-integration.md`) and POST the nonce to **`Transaction.sale`** (`braintree-transaction.md`).

## Optional fields

- **`cardholderName`**, **`postalCode`** — add selectors under `fields` when your integration requires them for AVS or fraud rules.
