# Webhooks (Flask)

PayPal sends **event notifications** to your HTTPS endpoint. Verify signatures using PayPal’s **Webhook APIs**, then process events idempotently.

## Register webhook URL

In the PayPal Developer Dashboard, add your public URL (e.g. `https://yourdomain.com/paypal-api/webhooks/events`) and subscribe to events (e.g. `PAYMENT.CAPTURE.COMPLETED`).

## Environment variables

| Variable | Purpose |
|----------|---------|
| `PAYPAL_WEBHOOK_ID` | Webhook ID from the Dashboard for the registered URL |
| `PAYPAL_CLIENT_ID` | REST app client ID |
| `PAYPAL_CLIENT_SECRET` | REST app secret |
| `PAYPAL_ENVIRONMENT` | `sandbox` or `production` |

## Flask webhook endpoint

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
    """POST /v1/notifications/verify-webhook-signature — official verification."""
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
    body = r.json()
    return body.get("verification_status") == "SUCCESS"


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

    return process_event(event)


def process_event(event: dict):
    """Idempotent handling — return 200 quickly; heavy work async."""
    etype = event.get("event_type")
    resource = event.get("resource") or {}

    if etype == "PAYMENT.CAPTURE.COMPLETED":
        capture_id = resource.get("id")
        _ = capture_id
    elif etype == "PAYMENT.CAPTURE.DENIED":
        pass

    return jsonify(ok=True), 200
```

## Alternative: manual HMAC verification (not preferred)

PayPal documents **API verification** (`verify-webhook-signature`) as the supported approach. Manual verification requires careful **certificate chain** validation; prefer the REST verification call above.

## Event processing best practices

- Respond **200** quickly; queue long tasks (email, fulfillment) to a worker.
- Store **`event.id`** and skip duplicates.
- Use **`resource`** payload fields per event type; re-fetch order/capture via API if you need full consistency.

## Security

- **HTTPS only** in production.
- **Reject** requests with invalid signatures before parsing sensitive operations.
- Do not trust client-supplied IDs without matching server state.

## Common issues

- **Wrong `PAYPAL_WEBHOOK_ID`**: Verification always fails — copy from the Dashboard for that exact URL.
- **Sandbox vs production**: Event delivery and verification URLs must match `PAYPAL_ENVIRONMENT`.
- **Body changes**: Pass the parsed **webhook event** object to the verify API as received; avoid mutating fields before verification.
