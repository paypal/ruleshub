# Webhooks — Expanded Checkout (Flask + signature verification)

Subscribe to **payment**, **vault**, and **authorization** events for card flows. Verify each delivery with **`POST /v1/notifications/verify-webhook-signature`** before side effects.

Base URLs:

| Environment | Base URL |
|-------------|----------|
| Sandbox | `https://api-m.sandbox.paypal.com` |
| Production | `https://api-m.paypal.com` |

## Environment variables

| Variable | Purpose |
|----------|---------|
| `PAYPAL_WEBHOOK_ID` | ID of the webhook URL in the Developer Dashboard |
| `PAYPAL_CLIENT_ID` | REST app client ID |
| `PAYPAL_CLIENT_SECRET` | REST app secret |
| `PAYPAL_ENVIRONMENT` | `sandbox` or `production` |

## Flask listener with verification

```python
import base64
import json
import os

import requests
from flask import Blueprint, jsonify, request

bp = Blueprint("paypal_webhooks", __name__, url_prefix="/paypal-api/webhooks")


def _paypal_base() -> str:
    env = os.environ.get("PAYPAL_ENVIRONMENT", "sandbox").lower()
    if env == "production":
        return "https://api-m.paypal.com"
    return "https://api-m.sandbox.paypal.com"


def _get_access_token() -> str:
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


def verify_webhook_signature(access_token: str, webhook_event: dict) -> bool:
    webhook_id = os.environ.get("PAYPAL_WEBHOOK_ID")
    if not webhook_id:
        raise RuntimeError("PAYPAL_WEBHOOK_ID is not configured")

    headers = request.headers
    payload = {
        "auth_algo": headers.get("PAYPAL-AUTH-ALGO"),
        "cert_url": headers.get("PAYPAL-CERT-URL"),
        "transmission_id": headers.get("PAYPAL-TRANSMISSION-ID"),
        "transmission_sig": headers.get("PAYPAL-TRANSMISSION-SIG"),
        "transmission_time": headers.get("PAYPAL-TRANSMISSION-TIME"),
        "webhook_id": webhook_id,
        "webhook_event": webhook_event,
    }
    url = f"{_paypal_base()}/v1/notifications/verify-webhook-signature"
    r = requests.post(
        url,
        headers={
            "Authorization": f"Bearer {access_token}",
            "Content-Type": "application/json",
        },
        json=payload,
        timeout=30,
    )
    r.raise_for_status()
    return r.json().get("verification_status") == "SUCCESS"


@bp.post("/events")
def paypal_webhook():
    raw = request.get_data(cache=False, as_text=True)
    try:
        event = json.loads(raw) if raw else {}
    except json.JSONDecodeError:
        return jsonify(error="invalid_json"), 400

    token = _get_access_token()
    try:
        ok = verify_webhook_signature(token, event)
    except requests.HTTPError as e:
        dbg = e.response.headers.get("PayPal-Debug-Id") if e.response else None
        return jsonify(error="verify_request_failed", paypal_debug_id=dbg), 502
    except RuntimeError:
        return jsonify(error="misconfigured_webhook"), 500

    if not ok:
        return jsonify(error="invalid_signature"), 400

    return process_expanded_event(event)


def process_expanded_event(event: dict):
    etype = event.get("event_type")
    resource = event.get("resource") or {}

    if etype == "PAYMENT.CAPTURE.COMPLETED":
        _ = resource.get("id")
    elif etype == "PAYMENT.CAPTURE.DENIED":
        pass
    elif etype == "PAYMENT.CAPTURE.PENDING":
        pass
    elif etype == "PAYMENT.CAPTURE.REFUNDED":
        pass
    elif etype == "VAULT.PAYMENT-TOKEN.CREATED":
        _ = resource.get("id")
    elif etype == "VAULT.PAYMENT-TOKEN.DELETED":
        pass
    elif etype == "PAYMENT.AUTHORIZATION.CREATED":
        pass
    elif etype == "PAYMENT.AUTHORIZATION.VOIDED":
        pass

    return jsonify(ok=True), 200
```

## Events to subscribe (Expanded Checkout)

| Category | Example `event_type` |
|----------|----------------------|
| Card capture | `PAYMENT.CAPTURE.COMPLETED`, `PAYMENT.CAPTURE.DENIED`, `PAYMENT.CAPTURE.PENDING` |
| Refunds | `PAYMENT.CAPTURE.REFUNDED` |
| Vault | `VAULT.PAYMENT-TOKEN.CREATED`, `VAULT.PAYMENT-TOKEN.DELETED` |
| Auth (AUTHORIZE intent) | `PAYMENT.AUTHORIZATION.CREATED`, `PAYMENT.AUTHORIZATION.VOIDED` |

## Best practices

- Respond **200** quickly; queue heavy work (email, fulfillment) asynchronously.
- Store **`event.id`** and skip duplicates (**idempotent** processing).
- Pass the **exact** parsed JSON body to **`verify-webhook-signature`** — do not mutate fields before verification.
