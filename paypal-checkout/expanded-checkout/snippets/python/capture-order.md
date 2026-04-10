# Capture order — Expanded Checkout (card response parsing)

After the buyer completes Card Fields (and **3D Secure** when required), **capture** the order with **Orders API v2** and inspect **`payment_source.card`** on the response for **brand**, **last digits**, and **authentication_result** (3DS / **liability_shift**).

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
from typing import Any, Dict, Optional

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


def _extract_capture_id(order_json: Dict[str, Any]) -> Optional[str]:
    for pu in order_json.get("purchase_units") or []:
        payments = pu.get("payments") or {}
        for cap in payments.get("captures") or []:
            cid = cap.get("id")
            if cid:
                return cid
    return None


def _parse_card_from_order(order_json: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    ps = order_json.get("payment_source") or {}
    card = ps.get("card")
    if not card:
        return None
    auth = card.get("authentication_result") or {}
    tds = auth.get("three_d_secure") or {}
    return {
        "brand": card.get("brand"),
        "last_digits": card.get("last_digits"),
        "type": card.get("type"),
        "liability_shift": auth.get("liability_shift"),
        "three_d_secure": {
            "enrollment_status": tds.get("enrollment_status"),
            "authentication_status": tds.get("authentication_status"),
        },
    }


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
    try:
        resp = requests.post(url, json={}, headers=headers, timeout=30)
        resp.raise_for_status()
    except requests.HTTPError as e:
        dbg = e.response.headers.get("PayPal-Debug-Id") if e.response else None
        return jsonify(error="capture_failed", paypal_debug_id=dbg), 502

    data = resp.json()
    capture_id = _extract_capture_id(data)
    card_info = _parse_card_from_order(data)

    return jsonify(
        order_id=data.get("id"),
        status=data.get("status"),
        capture_id=capture_id,
        card=card_info,
    )
```

## Fields to use for business logic

| Path | Meaning |
|------|---------|
| `payment_source.card.brand` | Network (e.g. VISA, MASTERCARD) |
| `payment_source.card.last_digits` | Last four digits |
| `payment_source.card.authentication_result.liability_shift` | **YES** / **NO** / **POSSIBLE** / **UNKNOWN** |
| `...three_d_secure.enrollment_status` | Issuer enrollment |
| `...three_d_secure.authentication_status` | Challenge outcome |

## Best practices

- Persist **`capture_id`** for refunds (`POST /v2/payments/captures/{id}/refund`).
- Apply **fulfillment rules** using **`liability_shift`** and 3DS statuses (see `3ds-integration.md`).
- Avoid returning full raw PayPal JSON to browsers in production; return safe subsets only.
