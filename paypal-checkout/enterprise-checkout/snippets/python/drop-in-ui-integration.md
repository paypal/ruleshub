# Drop-in UI — client JS + Jinja2, nonce POST to Flask (Braintree Direct)

Use **Braintree Drop-in** in the browser with the **`client_token`** from `braintree-client-token.md`. Flow: **`braintree.dropin.create`** → **`requestPaymentMethod()`** → **nonce** → **POST** to Flask → **`Transaction.sale`** (see `braintree-transaction.md`).

## Jinja2 template (example)

```html
<!-- templates/checkout.html -->
<div id="dropin-container"></div>
<button id="submit-button" type="button">Pay</button>

<script src="https://js.braintreegateway.com/web/dropin/1.45.2/js/dropin.min.js"></script>
<script>
  const clientToken = {{ client_token|tojson }};

  braintree.dropin.create({
    authorization: clientToken,
    container: "#dropin-container",
    // optional: vault, paypal, threeDSecure, etc. — see Braintree Drop-in docs
  }, (createErr, dropinInstance) => {
    if (createErr) {
      console.error(createErr);
      return;
    }

    const submit = document.querySelector("#submit-button");
    submit.addEventListener("click", () => {
      dropinInstance.requestPaymentMethod((err, payload) => {
        if (err) {
          console.error(err);
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
  });
</script>
```

## Flask — render with client token

```python
from flask import render_template

@app.get("/checkout")
def checkout_page():
    gw = braintree_gateway()
    token = gw.client_token.generate()
    return render_template("checkout.html", client_token=token)
```

## Flask — accept nonce

```python
from flask import request, jsonify

@app.post("/api/braintree/checkout")
def checkout():
    data = request.get_json(silent=True) or {}
    nonce = data.get("payment_method_nonce")
    if not nonce:
        return jsonify(error="missing_nonce"), 400

    gw = braintree_gateway()
    result = gw.transaction.sale(
        {
            "amount": "10.00",
            "payment_method_nonce": nonce,
            "options": {"submit_for_settlement": True},
        }
    )
    if not result.is_success:
        return jsonify(error=result.message), 400
    return jsonify(transaction_id=result.transaction.id, status=result.transaction.status)
```

## Notes

- Include **device data** on the server sale when using fraud tools (see `braintree-transaction.md`).
- For **3DS** with Drop-in, configure **`threeDSecure`** in `dropin.create` and handle verification on the client before requesting the nonce (see `braintree-3d-secure.md`).
