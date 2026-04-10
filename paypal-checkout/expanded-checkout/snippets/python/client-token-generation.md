# Browser-safe client token (Expanded Checkout, Flask)

PayPal **JS SDK v6** (Card Fields, Fastlane, Apple Pay, Google Pay) expects a **browser-safe client token** from your server. Obtain it via OAuth using **`response_type=client_token`** and **`intent=sdk_init`**, then return JSON the client uses in `createInstance({ clientToken })`.

## Endpoint

- **Route**: `GET /paypal-api/auth/browser-safe-client-token`
- **Response**: JSON `{ "client_token": "<token>" }` — never log the full token in production.

## PayPal OAuth request

- **Method**: `POST`
- **Path**: `/v1/oauth2/token`
- **Content-Type**: `application/x-www-form-urlencoded`
- **Body**: `grant_type=client_credentials&response_type=client_token&intent=sdk_init`
- **Authorization**: `Basic base64(PAYPAL_CLIENT_ID:PAYPAL_CLIENT_SECRET)`

Base URLs:

| Environment | Base URL |
|-------------|----------|
| Sandbox | `https://api-m.sandbox.paypal.com` |
| Production | `https://api-m.paypal.com` |

## Flask implementation with caching

```python
import base64
import os
from datetime import datetime, timedelta, timezone
from typing import Optional, Tuple

import requests
from flask import Blueprint, jsonify

bp = Blueprint("paypal_auth", __name__, url_prefix="/paypal-api/auth")

_cached_token: Optional[str] = None
_cached_expiry: Optional[datetime] = None
_SKEW_SECONDS = 60


def _paypal_base() -> str:
    env = os.environ.get("PAYPAL_ENVIRONMENT", "sandbox").lower()
    if env == "production":
        return "https://api-m.paypal.com"
    return "https://api-m.sandbox.paypal.com"


def _basic_auth_header() -> str:
    client_id = os.environ["PAYPAL_CLIENT_ID"]
    secret = os.environ["PAYPAL_CLIENT_SECRET"]
    raw = f"{client_id}:{secret}".encode("utf-8")
    return "Basic " + base64.b64encode(raw).decode("ascii")


def _fetch_client_token() -> Tuple[str, datetime]:
    url = f"{_paypal_base()}/v1/oauth2/token"
    headers = {
        "Authorization": _basic_auth_header(),
        "Content-Type": "application/x-www-form-urlencoded",
    }
    data = {
        "grant_type": "client_credentials",
        "response_type": "client_token",
        "intent": "sdk_init",
    }
    resp = requests.post(url, headers=headers, data=data, timeout=30)
    resp.raise_for_status()
    body = resp.json()
    token = body.get("access_token") or body.get("client_token")
    if not token:
        raise RuntimeError("No client token in OAuth response")
    expires_in = int(body.get("expires_in", 32400))
    expiry = datetime.now(timezone.utc) + timedelta(seconds=expires_in)
    return token, expiry


def get_browser_safe_client_token() -> str:
    global _cached_token, _cached_expiry
    now = datetime.now(timezone.utc)
    if (
        _cached_token
        and _cached_expiry
        and now < _cached_expiry - timedelta(seconds=_SKEW_SECONDS)
    ):
        return _cached_token
    token, expiry = _fetch_client_token()
    _cached_token = token
    _cached_expiry = expiry
    return token


@bp.get("/browser-safe-client-token")
def browser_safe_client_token():
    try:
        token = get_browser_safe_client_token()
        return jsonify(client_token=token)
    except requests.HTTPError as e:
        dbg = e.response.headers.get("PayPal-Debug-Id") if e.response else None
        return jsonify(error="token_failed", paypal_debug_id=dbg), 502
```

## Best practices

- Use **`timeout=`** on all `requests` calls.
- Refresh **before** true expiry (`_SKEW_SECONDS`).
- On errors, log **`PayPal-Debug-Id`** from response headers, not secrets or tokens.
- In multi-worker deployments, replace in-memory cache with **Redis** if you need a single shared cache.

## Common issues

- **401 INVALID_CLIENT**: Wrong credentials or wrong **base URL** for sandbox vs production.
- **Missing token in body**: Confirm both **`response_type=client_token`** and **`intent=sdk_init`** are present.
