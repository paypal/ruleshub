# Multiparty create order — `POST /v2/checkout/orders`, platform fees, Auth-Assertion, `experience_context`

Create a **PayPal** order where the **seller** is the payee and the **platform** takes a fee. Use **`payment_source.paypal.experience_context`** for return/cancel URLs, locale, brand, and UX flags. **Do not** use legacy top-level **`application_context`** for new integrations.

Use **`PayPal-Auth-Assertion`** (JWT) so PayPal knows the partner is acting on behalf of the seller.

Base URLs:

| Environment | Base URL |
|-------------|----------|
| Sandbox | `https://api-m.sandbox.paypal.com` |
| Production | `https://api-m.paypal.com` |

Reuse **`paypal_base()`** and **`get_access_token()`** from `seller-onboarding.md`.

## Build `PayPal-Auth-Assertion` (header value)

The value is a **signed JWT** whose claims include (at minimum) **`iss`** = partner REST **client_id** and **`payer_id`** = **seller merchant id**. Generate per current [Multiparty / partner documentation](https://developer.paypal.com/docs/multiparty/).

```text
PayPal-Auth-Assertion: eyJhbGciOi...<JWT>...
```

## `POST /v2/checkout/orders` — `requests`

```python
import os
import urllib.parse

import requests


def paypal_base() -> str:
    env = os.environ.get("PAYPAL_ENVIRONMENT", "sandbox").lower()
    return "https://api-m.paypal.com" if env == "production" else "https://api-m.sandbox.paypal.com"


def create_multiparty_order(
    access_token: str,
    *,
    seller_merchant_id: str,
    platform_fee_value: str,
    purchase_total_value: str,
    currency_code: str,
    auth_assertion_jwt: str,
    return_url: str,
    cancel_url: str,
) -> dict:
    body = {
        "intent": "CAPTURE",
        "purchase_units": [
            {
                "reference_id": "default",
                "amount": {
                    "currency_code": currency_code,
                    "value": purchase_total_value,
                    "breakdown": {
                        "item_total": {
                            "currency_code": currency_code,
                            "value": purchase_total_value,
                        },
                    },
                },
                "payee": {"merchant_id": seller_merchant_id},
                "payment_instruction": {
                    "platform_fees": [
                        {
                            "amount": {
                                "currency_code": currency_code,
                                "value": platform_fee_value,
                            },
                        },
                    ],
                },
            },
        ],
        "payment_source": {
            "paypal": {
                "experience_context": {
                    "payment_method_preference": "IMMEDIATE_PAYMENT_REQUIRED",
                    "brand_name": "My Marketplace",
                    "locale": "en-US",
                    "landing_page": "LOGIN",
                    "user_action": "PAY_NOW",
                    "return_url": return_url,
                    "cancel_url": cancel_url,
                    "shipping_preference": "GET_FROM_FILE",
                },
            },
        },
    }

    r = requests.post(
        f"{paypal_base()}/v2/checkout/orders",
        headers={
            "Authorization": f"Bearer {access_token}",
            "Content-Type": "application/json",
            "PayPal-Auth-Assertion": auth_assertion_jwt,
            "PayPal-Partner-Attribution-Id": os.environ.get("PAYPAL_BN_CODE", ""),
        },
        json=body,
        timeout=60,
    )
    r.raise_for_status()
    return r.json()
```

Resolve **`links`** for **`rel": "payer-action"`** or approve URL and send the buyer through PayPal checkout (JS SDK). Then **capture** on the server (`multiparty-capture.md`).

## Important

- **`purchase_units[].payee.merchant_id`**: onboarded seller (connected) merchant id.
- **`payment_instruction.platform_fees`**: platform cut; fee currency must match the transaction currency.
- **`payment_source.paypal.experience_context`**: wallet UX — **not** **`application_context`**.
- **`PayPal-Auth-Assertion`**: required for partner-initiated seller transactions per multiparty docs.

## Related

- `multiparty-capture.md` — capture and refunds with platform fees.
- `seller-onboarding.md` — obtain seller **`merchant_id`**.
