# Capture order (server-side)

After the buyer approves the order in the PayPal flow, **capture** funds with **Orders API v2**. Store the **capture ID** from the response for refunds and reconciliation.

## Endpoints

- **Flask**: `POST /paypal-api/checkout/orders/<order_id>/capture`
- **PayPal**: `POST {base}/v2/checkout/orders/{order_id}/capture`

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

bp = Blueprint("paypal_capture", __name__, url_prefix="/paypal-api/checkout/orders")


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


def _validate_order_id(order_id: str) -> bool:
    return bool(order_id and _ORDER_ID_RE.fullmatch(order_id))


@bp.post("/<order_id>/capture")
def capture_order(order_id: str):
    if not _validate_order_id(order_id):
        return jsonify(error="invalid_order_id"), 400

    token = _get_access_token()
    url = f"{_paypal_base()}/v2/checkout/orders/{order_id}/capture"
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json",
    }
    # Optional body: {} or partial amount for multi-capture scenarios per docs
    try:
        resp = requests.post(url, json={}, headers=headers, timeout=30)
        resp.raise_for_status()
    except requests.HTTPError as e:
        dbg = e.response.headers.get("PayPal-Debug-Id") if e.response else None
        return jsonify(error="capture_failed", paypal_debug_id=dbg), 502

    data = resp.json()
    capture_id = None
    status = data.get("status")
    for pu in data.get("purchase_units") or []:
        payments = pu.get("payments") or {}
        captures = payments.get("captures") or []
        if captures:
            capture_id = captures[0].get("id")
            break

    return jsonify(
        order_id=data.get("id"),
        status=status,
        capture_id=capture_id,
        raw=data,
    )
```

## Extracting capture ID for refunds

The capture ID looks like `2KG12345AB678901C` (example shape). Persist it in your database keyed by your internal order ID:

```python
# After successful capture, store capture_id for POST /v2/payments/captures/{id}/refund
```

## Alternative: return only safe fields

Avoid returning full `raw` to the browser in production; return `order_id`, `status`, `capture_id` only.

## Best practices

- Only capture after you are ready to fulfill; captures affect buyer statements.
- Treat **`COMPLETED`** (or equivalent capture status per response) as your trigger for digital delivery.
- Log **`PayPal-Debug-Id`** on failures, not full card or PII fields.

## Common issues

- **ORDER_NOT_APPROVED**: Capture called before buyer approval or wrong order ID.
- **RESOURCE_NOT_FOUND**: Wrong environment or typo in `order_id`.
- **INSTRUMENT_DECLINED** / risk declines: Surface a generic message; investigate with `PayPal-Debug-Id` in Dashboard.
