# Error handling (Flask + PayPal REST)

Production integrations should normalize errors for clients, extract **`PayPal-Debug-Id`** for support, and handle **`requests`** failures (timeouts, connection errors, HTTP errors) explicitly.

## PayPal Debug ID

PayPal returns **`PayPal-Debug-Id`** on API responses. Log it on **failure** (and optionally on success for traceability):

```python
def paypal_debug_id(response: requests.Response | None) -> str | None:
    if response is None:
        return None
    return response.headers.get("PayPal-Debug-Id")
```

Never log full request bodies containing secrets or card data.

## Flask application-level handlers

```python
from flask import Flask, jsonify

app = Flask(__name__)


@app.errorhandler(404)
def not_found(e):
    return jsonify(error="not_found"), 404


@app.errorhandler(500)
def internal(e):
    # Log server-side; generic message to client
    app.logger.exception("unhandled_error")
    return jsonify(error="internal_error"), 500
```

Register **blueprint** errors similarly or use `app.register_error_handler`.

## Retry with exponential backoff

Use for **idempotent** GETs or retries with a **new** `PayPal-Request-Id` only where PayPal documents idempotency rules.

```python
import random
import time
from typing import Callable

import requests


def call_with_backoff(
    fn: Callable[[], requests.Response],
    max_attempts: int = 4,
    base_delay: float = 0.5,
) -> requests.Response:
    last_exc = None
    for attempt in range(max_attempts):
        try:
            resp = fn()
            if resp.status_code >= 500 and attempt < max_attempts - 1:
                sleep_s = base_delay * (2**attempt) + random.random() * 0.1
                time.sleep(sleep_s)
                continue
            return resp
        except (requests.Timeout, requests.ConnectionError) as e:
            last_exc = e
            if attempt == max_attempts - 1:
                raise
            sleep_s = base_delay * (2**attempt) + random.random() * 0.1
            time.sleep(sleep_s)
    if last_exc:
        raise last_exc
    raise RuntimeError("backoff failed")
```

**Note:** Do not blindly retry **POST** without idempotency keys; prefer backoff only for **timeouts** on safe operations.

## `requests.exceptions` handling

```python
import requests

def safe_paypal_post(url, **kwargs):
    try:
        return requests.post(url, timeout=30, **kwargs)
    except requests.Timeout:
        # map to 504 / retry policy
        raise
    except requests.ConnectionError:
        # transient network — log and retry or 503
        raise
    except requests.RequestException:
        raise
```

## Mapping PayPal HTTP errors

```python
def paypal_error_message(resp: requests.Response) -> str:
    try:
        data = resp.json()
        details = data.get("details") or data
        if isinstance(details, list) and details:
            return str(details[0].get("issue") or "paypal_error")
        return str(data.get("message") or "paypal_error")
    except ValueError:
        return "paypal_error"
```

Return **`paypal_debug_id`** to your **support pipeline**, not necessarily to public clients.

## Best practices

- Always set **`timeout=`** on `requests` calls.
- Use **structured logging** (JSON) with `paypal_debug_id`, route name, and correlation ID.
- Rate-limit public-facing Flask routes to reduce abuse.

## Common issues

- **Swallowing exceptions**: Leads to 500 with no logs; always log stack traces server-side.
- **Logging bodies**: May contain PII; prefer status + debug id + error name.
- **Infinite retries** on 400-level PayPal errors: Fix the request instead of retrying.
