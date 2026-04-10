# Braintree client token — Flask GET endpoint (Enterprise / Braintree Direct)

Generate a **client token** on the server with **`gateway.client_token.generate()`**. The browser uses it to initialize Drop-in, Hosted Fields, or 3DS. Optionally pass **`customer_id`** to vault or show saved payment methods.

## Flask app setup

```python
import os

import braintree
from flask import Flask, jsonify

app = Flask(__name__)


def braintree_gateway() -> braintree.BraintreeGateway:
    env_name = os.environ.get("BRAINTREE_ENVIRONMENT", "sandbox").lower()
    env = braintree.Environment.Production if env_name == "production" else braintree.Environment.Sandbox
    return braintree.BraintreeGateway(
        braintree.Configuration(
            environment=env,
            merchant_id=os.environ["BRAINTREE_MERCHANT_ID"],
            public_key=os.environ["BRAINTREE_PUBLIC_KEY"],
            private_key=os.environ["BRAINTREE_PRIVATE_KEY"],
        )
    )
```

## GET `/api/braintree/client-token` — minimal

```python
@app.get("/api/braintree/client-token")
def client_token():
    gw = braintree_gateway()
    token = gw.client_token.generate()
    return jsonify(client_token=token)
```

## Optional `customer_id` (vault / returning buyer)

Pass a Braintree **customer id** so the client can display vaulted payment methods (with Drop-in `vaultManager`, etc.).

```python
from flask import request

@app.get("/api/braintree/client-token")
def client_token_with_customer():
    gw = braintree_gateway()
    customer_id = request.args.get("customer_id")

    params = {}
    if customer_id:
        params["customer_id"] = customer_id

    token = gw.client_token.generate(params)
    return jsonify(client_token=token)
```

## Error handling

- On failure, `generate()` raises — return **502** and log internally; never expose private keys.
- Validate **`customer_id`** belongs to the signed-in user before passing it to `generate()`.

## Related

- `drop-in-ui-integration.md` — consume `client_token` in the browser.
- `braintree-vault.md` — create customers before passing `customer_id`.
