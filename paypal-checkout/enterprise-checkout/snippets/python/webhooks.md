# Webhooks — Braintree + PayPal (`requests`)

Verify signatures **before** acting on payloads. Respond **200** quickly and process heavy work asynchronously.

## Braintree — `gateway.webhook_notification.parse()`

Use **raw body** text and the **`bt-signature`** header. Configure the webhook URL and validation in the Braintree Control Panel.

```python
import os

import braintree
from flask import Flask, request

app = Flask(__name__)


def braintree_gateway() -> braintree.BraintreeGateway:
    env_name = os.environ.get("BRAINTREE_ENVIRONMENT", "sandbox").lower()
    env = (
        braintree.Environment.Production
        if env_name == "production"
        else braintree.Environment.Sandbox
    )
    return braintree.BraintreeGateway(
        braintree.Configuration(
            environment=env,
            merchant_id=os.environ["BRAINTREE_MERCHANT_ID"],
            public_key=os.environ["BRAINTREE_PUBLIC_KEY"],
            private_key=os.environ["BRAINTREE_PRIVATE_KEY"],
        )
    )


@app.post("/webhooks/braintree")
def braintree_webhook():
    gw = braintree_gateway()
    bt_signature = request.headers.get("Bt-Signature") or request.headers.get("bt-signature")
    bt_payload = request.get_data(as_text=True)

    try:
        notification = gw.webhook_notification.parse(bt_signature, bt_payload)
    except Exception:
        return "", 400

    kind = notification.kind
    subject = notification.subject

    if kind == "transaction_settled":
        _ = getattr(subject, "transaction", None)
    elif kind == "transaction_settlement_declined":
        pass
    elif kind == "dispute_opened":
        _ = getattr(subject, "dispute", None)
    elif kind in ("dispute_lost", "dispute_won"):
        pass
    elif kind in (
        "subscription_charged_successfully",
        "subscription_charged_unsuccessfully",
    ):
        pass
    else:
        pass

    return "", 200
```

### Common `kind` values (examples)

- **`transaction_settled`**, **`transaction_settlement_declined`**
- **`dispute_opened`**, **`dispute_lost`**, **`dispute_won`**
- Subscription lifecycle events if you use Braintree subscriptions

## PayPal — `POST /v1/notifications/verify-webhook-signature`

```python
import base64
import os

import requests
from flask import Flask, request

app = Flask(__name__)


def paypal_base() -> str:
    env = os.environ.get("PAYPAL_ENVIRONMENT", "sandbox").lower()
    return "https://api-m.paypal.com" if env == "production" else "https://api-m.sandbox.paypal.com"


def get_access_token() -> str:
    cid = os.environ["PAYPAL_CLIENT_ID"]
    sec = os.environ["PAYPAL_CLIENT_SECRET"]
    auth = base64.b64encode(f"{cid}:{sec}".encode()).decode()
    r = requests.post(
        f"{paypal_base()}/v1/oauth2/token",
        headers={
            "Authorization": f"Basic {auth}",
            "Content-Type": "application/x-www-form-urlencoded",
        },
        data={"grant_type": "client_credentials"},
        timeout=30,
    )
    r.raise_for_status()
    return r.json()["access_token"]


@app.post("/webhooks/paypal")
def paypal_webhook():
    access_token = get_access_token()
    body = request.get_json(silent=True) or {}

    verification = {
        "auth_algo": request.headers.get("paypal-auth-algo"),
        "cert_url": request.headers.get("paypal-cert-url"),
        "transmission_id": request.headers.get("paypal-transmission-id"),
        "transmission_sig": request.headers.get("paypal-transmission-sig"),
        "transmission_time": request.headers.get("paypal-transmission-time"),
        "webhook_id": os.environ["PAYPAL_WEBHOOK_ID"],
        "webhook_event": body,
    }

    r = requests.post(
        f"{paypal_base()}/v1/notifications/verify-webhook-signature",
        headers={
            "Authorization": f"Bearer {access_token}",
            "Content-Type": "application/json",
        },
        json=verification,
        timeout=30,
    )

    if not r.ok:
        return "", 500

    data = r.json()
    if data.get("verification_status") != "SUCCESS":
        return "", 400

    event_type = body.get("event_type")
    if event_type == "PAYMENT.CAPTURE.COMPLETED":
        pass
    elif event_type in ("PAYMENT.CAPTURE.DENIED", "PAYMENT.CAPTURE.REFUNDED"):
        pass
    elif event_type == "MERCHANT.ONBOARDING.COMPLETED":
        pass
    elif event_type in (
        "CUSTOMER.MERCHANT-INTEGRATION.SELLER-ONBOARDING.STARTED",
        "CUSTOMER.MERCHANT-INTEGRATION.SELLER-ONBOARDING.COMPLETED",
    ):
        pass
    else:
        pass

    return "", 200
```

### Common `event_type` values (examples)

- **`PAYMENT.CAPTURE.COMPLETED`**, **`PAYMENT.CAPTURE.DENIED`**, **`PAYMENT.CAPTURE.REFUNDED`**
- **`MERCHANT.ONBOARDING.COMPLETED`**
- Seller onboarding variants under **`CUSTOMER.MERCHANT-INTEGRATION.*`**

Store **`PAYPAL_WEBHOOK_ID`** from the developer dashboard for verification. Log **`paypal-debug-id`** on failures.
