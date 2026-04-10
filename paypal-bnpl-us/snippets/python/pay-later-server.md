# Pay Later Server-Side (Python/Flask) — US

Server-side order creation and capture for Pay Later. No special order payload is needed — standard Orders API v2 works for Pay Later.

Source: https://docs.paypal.ai/reference/api/rest/orders/create-order

## Flask Implementation

```python
import os
import base64
import uuid
import requests
from flask import Flask, request, jsonify

app = Flask(__name__)

PAYPAL_CLIENT_ID = os.environ["PAYPAL_CLIENT_ID"]
PAYPAL_CLIENT_SECRET = os.environ["PAYPAL_CLIENT_SECRET"]
PAYPAL_BASE_URL = os.environ.get("PAYPAL_BASE_URL", "https://api-m.sandbox.paypal.com")


def get_access_token():
    auth = base64.b64encode(
        f"{PAYPAL_CLIENT_ID}:{PAYPAL_CLIENT_SECRET}".encode()
    ).decode()

    response = requests.post(
        f"{PAYPAL_BASE_URL}/v1/oauth2/token",
        headers={
            "Authorization": f"Basic {auth}",
            "Content-Type": "application/x-www-form-urlencoded",
        },
        data="grant_type=client_credentials",
    )
    response.raise_for_status()
    return response.json()["access_token"]


@app.route("/paypal-api/checkout/orders/create", methods=["POST"])
def create_order():
    """Create an order — works for PayPal, Pay Later, and PayPal Credit.
    PayPal determines which Pay Later product (Pay in 4, Pay Monthly) to
    offer based on buyer eligibility and order amount."""
    try:
        data = request.get_json()
        access_token = get_access_token()

        order_payload = {
            "intent": "CAPTURE",
            "purchase_units": [
                {
                    "amount": {
                        "currency_code": data.get("currency_code", "USD"),
                        "value": f"{float(data['amount']):.2f}",
                    }
                }
            ],
        }

        response = requests.post(
            f"{PAYPAL_BASE_URL}/v2/checkout/orders",
            headers={
                "Content-Type": "application/json",
                "Authorization": f"Bearer {access_token}",
                "PayPal-Request-Id": str(uuid.uuid4()),
            },
            json=order_payload,
        )

        return jsonify(response.json()), response.status_code

    except Exception as e:
        return jsonify({"error": "ORDER_CREATION_FAILED", "details": str(e)}), 500


@app.route("/paypal-api/checkout/orders/<order_id>/capture", methods=["POST"])
def capture_order(order_id):
    """Capture a previously approved order."""
    try:
        access_token = get_access_token()

        response = requests.post(
            f"{PAYPAL_BASE_URL}/v2/checkout/orders/{order_id}/capture",
            headers={
                "Content-Type": "application/json",
                "Authorization": f"Bearer {access_token}",
                "PayPal-Request-Id": str(uuid.uuid4()),
            },
        )

        return jsonify(response.json()), response.status_code

    except Exception as e:
        return jsonify({"error": "CAPTURE_FAILED", "details": str(e)}), 500
```

## Client Token Generation (for v6 clientToken auth)

Only needed if using `clientToken` authentication instead of `clientId`.

Source: https://docs.paypal.ai/developer/how-to/sdk/js/v6/configuration#option-b-client-token

```python
@app.route("/paypal-api/auth/browser-safe-client-token", methods=["GET"])
def get_client_token():
    """Generate a browser-safe client token for SDK v6."""
    try:
        auth = base64.b64encode(
            f"{PAYPAL_CLIENT_ID}:{PAYPAL_CLIENT_SECRET}".encode()
        ).decode()

        response = requests.post(
            f"{PAYPAL_BASE_URL}/v1/oauth2/token",
            headers={
                "Authorization": f"Basic {auth}",
                "Content-Type": "application/x-www-form-urlencoded",
            },
            data="grant_type=client_credentials&response_type=client_token",
        )
        response.raise_for_status()
        token_data = response.json()

        return jsonify({"client_token": token_data["access_token"]})

    except Exception as e:
        return jsonify({"error": "TOKEN_GENERATION_FAILED"}), 500
```

## Key Points

- No special API fields for Pay Later — standard `POST /v2/checkout/orders` works
- PayPal determines Pay Later eligibility server-side based on buyer + amount
- Use `intent: CAPTURE` for Pay Later transactions
- US Pay in 4 amount range: $30–$1,500; Pay Monthly: $49–$10,000
- Never embed `PAYPAL_CLIENT_SECRET` in client-side code
- Use environment variables for all credentials
