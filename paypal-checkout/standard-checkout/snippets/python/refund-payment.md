# Refund payment (captures)

Refunds target a **capture ID** (from the capture response). Use **Payments API** refund endpoint.

## Endpoints

- **Flask**: `POST /paypal-api/payments/captures/<capture_id>/refund`
- **PayPal**: `POST {base}/v2/payments/captures/{capture_id}/refund`

| Environment | Base URL |
|-------------|----------|
| Sandbox | `https://api-m.sandbox.paypal.com` |
| Production | `https://api-m.paypal.com` |

## Full refund

Send an empty JSON object `{}` or omit amount to refund the full capture (per PayPal behavior for that endpoint).

## Partial refund

Include `amount` with `currency_code` and `value` (two decimal places).

## Flask implementation

```python
import os
import re
import uuid
from decimal import Decimal, InvalidOperation

import requests
from flask import Blueprint, jsonify, request

bp = Blueprint("paypal_refunds", __name__, url_prefix="/paypal-api/payments/captures")


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


_CAPTURE_ID_RE = re.compile(r"^[A-Z0-9]+$")


def _validate_amount_partial(value: str, currency: str) -> dict:
    if not re.fullmatch(r"[A-Z]{3}", currency):
        raise ValueError("currency_code must be ISO 4217 uppercase")
    try:
        d = Decimal(value)
    except InvalidOperation as e:
        raise ValueError("invalid amount") from e
    if d <= 0:
        raise ValueError("refund amount must be positive")
    if value != f"{d:.2f}":
        raise ValueError("amount must have two decimal places")
    return {"currency_code": currency, "value": value}


@bp.post("/<capture_id>/refund")
def refund_capture(capture_id: str):
    if not _CAPTURE_ID_RE.fullmatch(capture_id or ""):
        return jsonify(error="invalid_capture_id"), 400

    payload = {}
    body = request.get_json(silent=True) or {}
    if body.get("amount") and body.get("currency_code"):
        try:
            payload["amount"] = _validate_amount_partial(
                str(body["amount"]).strip(),
                str(body["currency_code"]).upper(),
            )
        except ValueError as ve:
            return jsonify(error="validation_failed", detail=str(ve)), 400
    # Optional: invoice_id, note_to_payer — validate length if provided

    token = _get_access_token()
    url = f"{_paypal_base()}/v2/payments/captures/{capture_id}/refund"
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json",
        "PayPal-Request-Id": str(uuid.uuid4()),
    }
    try:
        resp = requests.post(url, json=payload, headers=headers, timeout=30)
        resp.raise_for_status()
    except requests.HTTPError as e:
        dbg = e.response.headers.get("PayPal-Debug-Id") if e.response else None
        return jsonify(error="refund_failed", paypal_debug_id=dbg), 502

    return jsonify(resp.json())
```

## Alternative: admin-only route

Protect with API key, VPN, or internal auth; refunds are high-risk operations.

## Best practices

- Persist **capture ID** at capture time; refunds cannot target order ID alone.
- Use a **unique `PayPal-Request-Id`** per refund attempt for safe retries.
- For partial refunds, track cumulative refunded amount vs original capture.

## Common issues

- **CAPTURE_FULLY_REFUNDED**: No remaining funds to refund.
- **REFUND_AMOUNT_EXCEEDED**: Partial refund too large vs remaining balance.
- **RESOURCE_NOT_FOUND**: Wrong `capture_id` or environment.
