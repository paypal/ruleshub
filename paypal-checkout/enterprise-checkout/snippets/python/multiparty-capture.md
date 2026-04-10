# Multiparty capture and refunds — Auth-Assertion, fee split, platform fee refund (`requests`)

**Capture** the approved order with **`POST /v2/checkout/orders/{order_id}/capture`** and the same **`PayPal-Auth-Assertion`** used at create time. **Refunds** can include **`payment_instruction.platform_fees`** to refund part of the platform fee.

Reuse **`paypal_base()`** and **`get_access_token()`** from `seller-onboarding.md` or `multiparty-create-order.md`.

## Capture order

```python
import urllib.parse

import requests


def capture_multiparty_order(
    access_token: str,
    order_id: str,
    auth_assertion_jwt: str,
    paypal_base_url: str,
) -> dict:
    oid = urllib.parse.quote(order_id, safe="")
    r = requests.post(
        f"{paypal_base_url}/v2/checkout/orders/{oid}/capture",
        headers={
            "Authorization": f"Bearer {access_token}",
            "Content-Type": "application/json",
            "PayPal-Auth-Assertion": auth_assertion_jwt,
        },
        json={},
        timeout=60,
    )
    r.raise_for_status()
    return r.json()
```

### Fee split (response)

Inspect **`purchase_units[0].payments.captures[]`** and **`seller_receivable_breakdown`** (and related fields) per Orders API v2 for reconciliation.

## Refund capture with platform fee component

```python
def refund_capture_with_platform_fee(
    access_token: str,
    capture_id: str,
    *,
    amount: str,
    platform_fee_refund: str,
    currency_code: str = "USD",
    auth_assertion_jwt: str,
    paypal_base_url: str,
) -> dict:
    cid = urllib.parse.quote(capture_id, safe="")
    body = {
        "amount": {"currency_code": currency_code, "value": amount},
        "payment_instruction": {
            "platform_fees": [
                {
                    "amount": {
                        "currency_code": currency_code,
                        "value": platform_fee_refund,
                    },
                },
            ],
        },
    }
    r = requests.post(
        f"{paypal_base_url}/v2/payments/captures/{cid}/refund",
        headers={
            "Authorization": f"Bearer {access_token}",
            "Content-Type": "application/json",
            "PayPal-Auth-Assertion": auth_assertion_jwt,
        },
        json=body,
        timeout=60,
    )
    r.raise_for_status()
    return r.json()
```

Align **`platform_fees`** with PayPal multiparty refund rules (currency match, eligible captures). Consult the current Captures Refund API reference for optional fields (invoice id, note to payer).

## Base URLs

| Environment | Base URL |
|-------------|----------|
| Sandbox | `https://api-m.sandbox.paypal.com` |
| Production | `https://api-m.paypal.com` |
