# Error handling — Card declines, 3DS, Flask, Debug IDs

Expanded Checkout surfaces **card declines**, **3D Secure** failures, and **instrument** errors through PayPal **API error bodies** and HTTP status codes. Log **`PayPal-Debug-Id`** from response headers; never log PAN, CVV, or full client tokens.

## Card decline errors

Common REST **`name`** / issue types include instrument declines and risk-related failures. For buyer-facing copy, use **generic** messages (“Your card could not be charged. Try another payment method.”) and reserve details for internal logs with **`PayPal-Debug-Id`**.

Reference: [Card decline errors](https://developer.paypal.com/docs/checkout/advanced/card-decline-errors/) (PayPal).

## 3DS-related outcomes

Treat **authentication failures** separately from network errors:

- If **`authentication_status`** is **`N`** or **`R`** (see `3ds-integration.md`), do not assume SCA success even when HTTP status is 200 on some edge responses — align fulfillment with your risk policy.
- **`INSTRUMENT_DECLINED`** on capture: prompt for another card or wallet.

## Flask — extract Debug ID on HTTP errors

```python
import logging
import requests

log = logging.getLogger(__name__)


def paypal_http_error_detail(exc: requests.HTTPError) -> dict:
    resp = exc.response
    dbg = resp.headers.get("PayPal-Debug-Id") if resp else None
    body = {}
    try:
        body = resp.json() if resp is not None and resp.content else {}
    except ValueError:
        pass
    log.warning(
        "paypal_http_error status=%s debug_id=%s name=%s",
        getattr(resp, "status_code", None),
        dbg,
        body.get("name"),
    )
    return {
        "paypal_debug_id": dbg,
        "error": body.get("name") or "paypal_error",
        "message": body.get("message"),
    }
```

Return **`paypal_debug_id`** to internal dashboards only; for public APIs return **`error`** plus a **safe** `message`.

## Flask — global error handlers (optional)

```python
from flask import Flask, jsonify

app = Flask(__name__)


@app.errorhandler(400)
def bad_request(_e):
    return jsonify(error="bad_request"), 400


@app.errorhandler(500)
def server_error(_e):
    return jsonify(error="internal_error"), 500
```

Keep handlers **generic** for clients; record stack traces and **`PayPal-Debug-Id`** server-side.

## Client-side Card Fields

- Handle **`onError`** (v5) or rejected promises (v6) from submit flows.
- Show retry / alternate PM options when declines occur.

## PayPal Debug IDs

Every PayPal REST response can include **`PayPal-Debug-Id`**. When opening PayPal support cases, provide:

- Timestamp, **order id** (if any), endpoint, and **`PayPal-Debug-Id`**

## Retry guidance

- Safe retries: use **`PayPal-Request-Id`** on **create order** for idempotent creates.
- Avoid blind **capture** retries without confirming order state — **`GET /v2/checkout/orders/{id}`** first if unsure.
