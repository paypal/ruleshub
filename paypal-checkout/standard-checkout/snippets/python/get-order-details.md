# Get order details (server-side)

Use **GET /v2/checkout/orders/{id}** to inspect order state, amounts, payer, and shipping after creation or approval.

## Endpoints

- **Flask**: `GET /paypal-api/checkout/orders/<order_id>`
- **PayPal**: `GET {base}/v2/checkout/orders/{order_id}`

| Environment | Base URL |
|-------------|----------|
| Sandbox | `https://api-m.sandbox.paypal.com` |
| Production | `https://api-m.paypal.com` |

## Flask implementation

```python
import os
import re

import requests
from flask import Blueprint, jsonify

bp = Blueprint("paypal_order_get", __name__, url_prefix="/paypal-api/checkout/orders")


def _paypal_base() -> str:
    env = os.environ.get("PAYPAL_ENVIRONMENT", "sandbox").lower()
    if env == "production":
        return "https://api-m.paypal.com"
    return "https://api-m.sandbox.paypal.com"


def _get_access_token() -> str:
    import base64
    cid = os.environ["PAYPAL_CLIENT_ID"]
    sec = os.environ["PAYPAL_CLIENT_SECRET"]
    auth = base64.b64encode(f"{cid}:{sec}".encode()).decode()
    url = f"{_paypal_base()}/v1/oauth2/token"
    r = requests.post(
        url,
        headers={
            "Authorization": f"Basic {auth}",
            "Content-Type": "application/x-www-form-urlencoded",
        },
        data={"grant_type": "client_credentials"},
        timeout=30,
    )
    r.raise_for_status()
    return r.json()["access_token"]


_ORDER_ID_RE = re.compile(r"^[A-Z0-9]+$")


@bp.get("/<order_id>")
def get_order(order_id: str):
    if not (order_id and _ORDER_ID_RE.fullmatch(order_id)):
        return jsonify(error="invalid_order_id"), 400

    token = _get_access_token()
    url = f"{_paypal_base()}/v2/checkout/orders/{order_id}"
    headers = {"Authorization": f"Bearer {token}"}
    try:
        resp = requests.get(url, headers=headers, timeout=30)
        resp.raise_for_status()
    except requests.HTTPError as e:
        dbg = e.response.headers.get("PayPal-Debug-Id") if e.response else None
        code = e.response.status_code if e.response else 502
        return jsonify(error="get_order_failed", paypal_debug_id=dbg), code

    return jsonify(resp.json())
```

## Alternative: internal service only

Restrict this route to authenticated admin or server-to-server callers; order payloads can include PII.

## Use cases

- Verify **`status`** (`CREATED`, `APPROVED`, `COMPLETED`, etc.) before capture or fulfillment.
- Read **`purchase_units[0].amount`** to confirm totals match your cart.
- Inspect **`payer`** / **`shipping`** when using PayPal-provided addresses.

## Best practices

- Do not expose full GET responses to unauthenticated clients.
- Cache short-term if you poll (prefer webhooks for state changes where possible).

## Common issues

- **404**: Wrong `order_id` or environment mismatch (sandbox order queried on production).
- **401**: Invalid OAuth token or credentials.
