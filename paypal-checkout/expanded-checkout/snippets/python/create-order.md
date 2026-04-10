# Create order — Expanded Checkout (card + `experience_context`)

For Expanded Checkout, create orders with **Orders API v2** using **`payment_source.card`** for card payments. Configure **Strong Customer Authentication / 3D Secure** via **`payment_source.card.attributes.verification`**.

**Do not** use legacy top-level **`application_context`** on the order. Use:

- **`payment_source.paypal.experience_context`** for PayPal wallet checkout.
- **`payment_source.card`** for card checkout — include **`experience_context`** on the **card** object when you need **return_url** / **cancel_url** (for example 3D Secure redirects).

Base URLs:

| Environment | Base URL |
|-------------|----------|
| Sandbox | `https://api-m.sandbox.paypal.com` |
| Production | `https://api-m.paypal.com` |

## Endpoints

- **Flask**: `POST /paypal-api/checkout/orders/create`
- **PayPal**: `POST {base}/v2/checkout/orders`

## Request body (examples)

**Card payment** with SCA when required:

```json
{
  "intent": "CAPTURE",
  "purchase_units": [
    {
      "amount": { "currency_code": "USD", "value": "50.00" }
    }
  ],
  "payment_source": {
    "card": {
      "experience_context": {
        "return_url": "https://yoursite.com/paypal/return",
        "cancel_url": "https://yoursite.com/paypal/cancel"
      },
      "attributes": {
        "verification": {
          "method": "SCA_WHEN_REQUIRED"
        }
      }
    }
  }
}
```

**PayPal wallet** (reference — uses `paypal`, not `application_context`):

```json
{
  "intent": "CAPTURE",
  "purchase_units": [
    {
      "amount": { "currency_code": "USD", "value": "50.00" }
    }
  ],
  "payment_source": {
    "paypal": {
      "experience_context": {
        "payment_method_preference": "IMMEDIATE_PAYMENT_REQUIRED",
        "user_action": "PAY_NOW",
        "shipping_preference": "NO_SHIPPING"
      }
    }
  }
}
```

## Flask implementation (card-focused)

```python
import os
import re
import uuid
from decimal import Decimal, InvalidOperation
from typing import Any, Dict

import requests
from flask import Blueprint, jsonify, request

bp = Blueprint("paypal_orders", __name__, url_prefix="/paypal-api/checkout/orders")


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


def _validate_amount(value: str, currency: str) -> None:
    if not re.fullmatch(r"[A-Z]{3}", currency):
        raise ValueError("currency_code must be 3-letter ISO 4217 uppercase")
    try:
        d = Decimal(value)
    except Exception as e:
        raise ValueError("amount must be a decimal string") from e
    if d <= 0:
        raise ValueError("amount must be positive")
    if value != f"{d:.2f}":
        raise ValueError("amount must use exactly two decimal places")


def _card_payload(
    public_base: str,
    verification_method: str = "SCA_WHEN_REQUIRED",
) -> Dict[str, Any]:
    return {
        "card": {
            "experience_context": {
                "return_url": f"{public_base.rstrip('/')}/paypal/return",
                "cancel_url": f"{public_base.rstrip('/')}/paypal/cancel",
            },
            "attributes": {
                "verification": {"method": verification_method},
            },
        }
    }


@bp.post("/create")
def create_order():
    if not request.is_json:
        return jsonify(error="expected_json"), 400
    body = request.get_json(silent=True) or {}
    try:
        currency = str(body.get("currency_code", "USD")).upper()
        value = str(body.get("amount", "")).strip()
        intent = str(body.get("intent", "CAPTURE")).upper()
        funding = str(body.get("funding_source", "card")).lower()
        if intent not in ("CAPTURE", "AUTHORIZE"):
            raise ValueError("invalid intent")
        _validate_amount(value, currency)
    except ValueError as ve:
        return jsonify(error="validation_failed", detail=str(ve)), 400

    public_base = os.environ.get("PUBLIC_SITE_BASE_URL", "https://localhost:5000")

    payload: Dict[str, Any] = {
        "intent": intent,
        "purchase_units": [{"amount": {"currency_code": currency, "value": value}}],
    }
    if body.get("custom_id"):
        payload["purchase_units"][0]["custom_id"] = str(body["custom_id"])[:127]

    if funding == "card":
        payload["payment_source"] = _card_payload(
            public_base,
            verification_method=str(
                body.get("verification_method", "SCA_WHEN_REQUIRED")
            ).upper(),
        )
    elif funding == "paypal":
        payload["payment_source"] = {
            "paypal": {
                "experience_context": {
                    "payment_method_preference": "IMMEDIATE_PAYMENT_REQUIRED",
                    "user_action": "PAY_NOW",
                    "shipping_preference": str(
                        body.get("shipping_preference", "NO_SHIPPING")
                    ),
                }
            }
        }
    else:
        return jsonify(error="unsupported_funding_source"), 400

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

## Verification methods

| Method | Use |
|--------|-----|
| **`SCA_WHEN_REQUIRED`** | Default — 3DS when issuer/regulation/risk requires it |
| **`SCA_ALWAYS`** | Always challenge with 3DS (stricter, may reduce conversion) |

## Best practices

- Send **`PayPal-Request-Id`** (UUID) for idempotent retries.
- Set **`PUBLIC_SITE_BASE_URL`** to your real HTTPS origin so **return_url** / **cancel_url** resolve correctly in production.
