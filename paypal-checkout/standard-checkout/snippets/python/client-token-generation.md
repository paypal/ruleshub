# Server-side client token (PayPal JS SDK v6)

PayPal **v6** expects a **browser-safe client token** from your server. Obtain it with OAuth using `response_type=client_token` and `intent=sdk_init`, then return it to the client for `createInstance({ clientToken })`.

This snippet uses **Flask**, **`requests`**, **Basic auth (Base64)**, and **in-memory token caching** with expiration.

## Endpoint

- **Route**: `GET /paypal-api/auth/browser-safe-client-token`
- **Response**: JSON `{ "client_token": "..." }` (never log the full token in production logs).

## PayPal OAuth request

- **Method**: `POST`
- **Path**: `/v1/oauth2/token`
- **Content-Type**: `application/x-www-form-urlencoded`
- **Body**: `grant_type=client_credentials&response_type=client_token&intent=sdk_init`
- **Authorization**: `Basic base64(client_id:client_secret)`

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

# Module-level cache (use Redis in multi-worker production if needed)
_cached_token: Optional[str] = None
_cached_expiry: Optional[datetime] = None
# Refresh a bit before true expiry
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
    # PayPal returns expires_in in seconds for access_token-style responses
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
        # Log PayPal Debug ID from headers, not body secrets
        dbg = e.response.headers.get("PayPal-Debug-Id") if e.response else None
        return jsonify(error="token_failed", paypal_debug_id=dbg), 502
```

## Alternative: no global cache (single-request)

For tests or single-worker demos, you may skip caching and call `_fetch_client_token()` on every request. For production, prefer caching or a shared store to reduce OAuth load.

## Best practices

- Use **timeouts** on all `requests` calls (`timeout=30` or your SLO).
- Cache until shortly before **expiration** to avoid serving expired tokens.
- Log **`PayPal-Debug-Id`** from response headers on errors, not the token or client secret.
- In multi-process deployments (e.g. Gunicorn workers), each process has its own memory cache; use **Redis** if you need a single shared cache.

## Common issues

- **401 INVALID_CLIENT**: Wrong `PAYPAL_CLIENT_ID` / `PAYPAL_CLIENT_SECRET` or wrong environment base URL.
- **Missing `client_token` in JSON**: Confirm `response_type=client_token` and `intent=sdk_init` are both present in the form body.
- **Clock skew**: If server time is wrong, expiry math breaks; sync NTP on hosts.
