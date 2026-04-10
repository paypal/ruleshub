# Agentic commerce / Store Sync — Cart API (`requests`), orders, checkout

**Store Sync** exposes product catalogs for AI agents; **Cart API** models carts server-side. Flow: **create cart** → buyer approves payment → **complete checkout** (or map cart to **Orders v2** / **Braintree** per your integration).

Base URLs:

| Environment | Base URL |
|-------------|----------|
| Sandbox | `https://api-m.sandbox.paypal.com` |
| Production | `https://api-m.paypal.com` |

## OAuth

Use the same **`client_credentials`** token as other REST calls (`get_access_token()` in `seller-onboarding.md`).

## Cart API — `POST /v2/cart`

```python
import os
import uuid

import requests


def paypal_base() -> str:
    env = os.environ.get("PAYPAL_ENVIRONMENT", "sandbox").lower()
    return "https://api-m.paypal.com" if env == "production" else "https://api-m.sandbox.paypal.com"


def create_cart(access_token: str, payload: dict) -> dict:
    r = requests.post(
        f"{paypal_base()}/v2/cart",
        headers={
            "Authorization": f"Bearer {access_token}",
            "Content-Type": "application/json",
            "PayPal-Request-Id": str(uuid.uuid4()),
        },
        json=payload,
        timeout=60,
    )
    r.raise_for_status()
    return r.json()
```

Align **`payload`** with the current Cart API schema (`intent`, line items, payee, experience context, etc.) in the developer reference.

## `GET /v2/cart/{cart_id}`

```python
import urllib.parse


def get_cart(access_token: str, cart_id: str) -> dict:
    cid = urllib.parse.quote(cart_id, safe="")
    r = requests.get(
        f"{paypal_base()}/v2/cart/{cid}",
        headers={"Authorization": f"Bearer {access_token}"},
        timeout=60,
    )
    r.raise_for_status()
    return r.json()
```

## `PATCH /v2/cart/{cart_id}`

```python
def patch_cart(access_token: str, cart_id: str, patch_body: dict) -> dict:
    cid = urllib.parse.quote(cart_id, safe="")
    r = requests.patch(
        f"{paypal_base()}/v2/cart/{cid}",
        headers={
            "Authorization": f"Bearer {access_token}",
            "Content-Type": "application/json",
            "PayPal-Request-Id": str(uuid.uuid4()),
        },
        json=patch_body,
        timeout=60,
    )
    r.raise_for_status()
    return r.json()
```

## Store Sync + checkout paths

1. **Orders v2** — map cart totals to **`POST /v2/checkout/orders`** (`multiparty-create-order.md` for platform fees and **`payment_source.paypal.experience_context`**).
2. **Complete checkout** — call **Complete Checkout** after buyer approval per [Complete checkout](https://docs.paypal.ai/reference/api/rest/checkout/complete-checkout) and the current API contract.
3. **Braintree** — client tokenize, then **`gateway.transaction.sale`** (`braintree-transaction.md`); vault if needed (`braintree-vault.md`).

Keep **one source of truth** for amounts so cart lines match Orders or Braintree payloads.

## Agent discovery

Agents use **Store Sync** catalog surfaces and merchant-configured agentic flows; carts created via API let the buyer finish in PayPal checkout or your app depending on integration.

## References

- [Agentic commerce overview](https://docs.paypal.ai/growth/agentic-commerce/overview)
- [Store Sync overview](https://docs.paypal.ai/growth/agentic-commerce/store-sync/overview)
