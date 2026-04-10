# Create order (server-side)

For **PayPal JS SDK v6**, order creation **must** happen on your server. The client calls your Flask route; your server calls **Orders API v2**.

## Endpoint

- **Flask**: `POST /paypal-api/checkout/orders/create`
- **PayPal**: `POST {base}/v2/checkout/orders`

Base URLs:

| Environment | Base URL |
|-------------|----------|
| Sandbox | `https://api-m.sandbox.paypal.com` |
| Production | `https://api-m.paypal.com` |

## Request validation

- Require JSON `Content-Type`.
- Validate `currency_code` (ISO 4217), `value` (string with two decimals), and optional `intent` (`CAPTURE` | `AUTHORIZE`).
- Reject negative or zero amounts.

## Flask implementation

```python
import os
import re
import uuid
from decimal import Decimal, InvalidOperation

import requests
from flask import Blueprint, jsonify, request

bp = Blueprint("paypal_orders", __name__, url_prefix="/paypal-api/checkout/orders")


def _paypal_base() -> str:
    env = os.environ.get("PAYPAL_ENVIRONMENT", "sandbox").lower()
    if env == "production":
        return "https://api-m.paypal.com"
    return "https://api-m.sandbox.paypal.com"


def _get_access_token() -> str:
    # Reuse your shared OAuth helper (client credentials) — see client-token-generation / prerequisites
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


def _validate_amount(value: str, currency: str) -> None:
    if not re.fullmatch(r"[A-Z]{3}", currency):
        raise ValueError("currency_code must be 3-letter ISO 4217 uppercase")
    try:
        d = Decimal(value)
    except InvalidOperation as e:
        raise ValueError("amount must be a decimal string") from e
    if d <= 0:
        raise ValueError("amount must be positive")
    if value != f"{d:.2f}":
        raise ValueError("amount must use exactly two decimal places")


@bp.post("/create")
def create_order():
    if not request.is_json:
        return jsonify(error="expected_json"), 400
    body = request.get_json(silent=True) or {}
    try:
        currency = str(body.get("currency_code", "USD")).upper()
        value = str(body.get("amount", "")).strip()
        intent = str(body.get("intent", "CAPTURE")).upper()
        if intent not in ("CAPTURE", "AUTHORIZE"):
            raise ValueError("invalid intent")
        _validate_amount(value, currency)
    except ValueError as ve:
        return jsonify(error="validation_failed", detail=str(ve)), 400

    payload = {
        "intent": intent,
        "purchase_units": [
            {
                "amount": {"currency_code": currency, "value": value},
            }
        ],
    }
    # Optional: custom_id / invoice_id from body after validation
    if body.get("custom_id"):
        payload["purchase_units"][0]["custom_id"] = str(body["custom_id"])[:127]

    token = _get_access_token()
    url = f"{_paypal_base()}/v2/checkout/orders"
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
        return jsonify(error="paypal_error", paypal_debug_id=dbg), 502

    data = resp.json()
    return jsonify(id=data.get("id"), status=data.get("status"), links=data.get("links"))
```

## Alternative: minimal payload only

For internal services you may accept only `{ "amount", "currency_code" }` and fix `intent` to `CAPTURE` to reduce attack surface.

## Best practices

- Send **`PayPal-Request-Id`** (UUID) for safe retries on transient failures.
- Use **`Decimal`** for amount checks; never use binary floats for money.
- Map PayPal error bodies to safe client messages; do not expose raw PayPal responses to browsers in production.

## Common issues

- **AMOUNT_MISMATCH**: If you add `items` and `breakdown`, totals must match line items exactly.
- **422**: Often invalid currency or malformed `purchase_units`.
- **401**: Expired or wrong OAuth token; confirm environment matches credentials.

## Error handling

Use `try/except requests.HTTPError` and log `PayPal-Debug-Id`. See `error-handling.md` for retries and backoff.
