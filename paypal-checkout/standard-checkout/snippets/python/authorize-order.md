# Authorization flow (authorize, capture, void, reauthorize)

For **delayed capture**, create orders with **`intent": "AUTHORIZE"`**, then use Payments endpoints to **capture** the authorization, **void** it, or **reauthorize** before capture per PayPal rules.

Base URLs for REST:

| Environment | Base URL |
|-------------|----------|
| Sandbox | `https://api-m.sandbox.paypal.com` |
| Production | `https://api-m.paypal.com` |

## 1. Create order (AUTHORIZE)

Same as create order with `intent: AUTHORIZE` — see `create-order.md`.

## 2. Authorize (after buyer approves)

Typically authorization is completed when the buyer approves; your server then **GET**s the order and reads the authorization object, or uses the authorize link from the order response. For explicit authorize where applicable:

- **PayPal**: `POST {base}/v2/checkout/orders/{order_id}/authorize`

## Flask routes (patterns)

Below, `_paypal_base()`, `_get_access_token()`, and order ID validation match other snippets.

```python
import os
import re
import uuid

import requests
from flask import Blueprint, jsonify, request

bp = Blueprint("paypal_authz", __name__, url_prefix="/paypal-api/checkout")


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
_AUTH_ID_RE = re.compile(r"^[A-Z0-9]+$")


def _paypal_post(path: str, payload=None):
    token = _get_access_token()
    url = f"{_paypal_base()}{path}"
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json",
        "PayPal-Request-Id": str(uuid.uuid4()),
    }
    resp = requests.post(url, json=payload or {}, headers=headers, timeout=30)
    resp.raise_for_status()
    return resp.json()


# POST /v2/checkout/orders/{id}/authorize — when your integration calls it explicitly
@bp.post("/orders/<order_id>/authorize")
def authorize_order(order_id: str):
    if not _ORDER_ID_RE.fullmatch(order_id or ""):
        return jsonify(error="invalid_order_id"), 400
    try:
        data = _paypal_post(f"/v2/checkout/orders/{order_id}/authorize")
    except requests.HTTPError as e:
        dbg = e.response.headers.get("PayPal-Debug-Id") if e.response else None
        return jsonify(error="authorize_failed", paypal_debug_id=dbg), 502
    return jsonify(data)


# POST /v2/payments/authorizations/{authorization_id}/capture
@bp.post("/authorizations/<authorization_id>/capture")
def capture_authorization(authorization_id: str):
    if not _AUTH_ID_RE.fullmatch(authorization_id or ""):
        return jsonify(error="invalid_authorization_id"), 400
    body = request.get_json(silent=True) or {}
    try:
        data = _paypal_post(
            f"/v2/payments/authorizations/{authorization_id}/capture",
            body,
        )
    except requests.HTTPError as e:
        dbg = e.response.headers.get("PayPal-Debug-Id") if e.response else None
        return jsonify(error="capture_failed", paypal_debug_id=dbg), 502
    return jsonify(data)


# POST /v2/payments/authorizations/{authorization_id}/void
@bp.post("/authorizations/<authorization_id>/void")
def void_authorization(authorization_id: str):
    if not _AUTH_ID_RE.fullmatch(authorization_id or ""):
        return jsonify(error="invalid_authorization_id"), 400
    try:
        data = _paypal_post(
            f"/v2/payments/authorizations/{authorization_id}/void",
            {},
        )
    except requests.HTTPError as e:
        dbg = e.response.headers.get("PayPal-Debug-Id") if e.response else None
        return jsonify(error="void_failed", paypal_debug_id=dbg), 502
    return jsonify(data)


# POST /v2/payments/authorizations/{authorization_id}/reauthorize
@bp.post("/authorizations/<authorization_id>/reauthorize")
def reauthorize(authorization_id: str):
    if not _AUTH_ID_RE.fullmatch(authorization_id or ""):
        return jsonify(error="invalid_authorization_id"), 400
    body = request.get_json(silent=True) or {}
    try:
        data = _paypal_post(
            f"/v2/payments/authorizations/{authorization_id}/reauthorize",
            body,
        )
    except requests.HTTPError as e:
        dbg = e.response.headers.get("PayPal-Debug-Id") if e.response else None
        return jsonify(error="reauthorize_failed", paypal_debug_id=dbg), 502
    return jsonify(data)
```

## Mapping IDs

- After order is authorized, read **`purchase_units[].payments.authorizations[]`** from **GET order** or capture response paths in docs to obtain **`authorization_id`**.

## Best practices

- Void unused authorizations promptly to release holds on the buyer’s funding source.
- Respect authorization **expiration**; use **reauthorize** only where PayPal allows and before expiry rules.
- Use idempotent **`PayPal-Request-Id`** for capture/void retries.

## Common issues

- **AUTHORIZATION_ALREADY_CAPTURED**: Duplicate capture attempt.
- **AUTHORIZATION_VOIDED**: Void after partial operations not allowed in that state.
- Amount mismatch on capture: must not exceed authorized amount (see API error details).
