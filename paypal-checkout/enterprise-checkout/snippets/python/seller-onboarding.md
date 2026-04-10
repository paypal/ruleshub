# Seller onboarding — Partner Referrals + status (Multiparty / `requests`)

Create a seller onboarding link with **`POST /v2/customer/partner-referrals`**. After the seller completes PayPal, check status with **`GET /v1/customer/partners/{partner_id}/merchant-integrations/{merchant_id}`**.

Base URLs:

| Environment | Base URL |
|-------------|----------|
| Sandbox | `https://api-m.sandbox.paypal.com` |
| Production | `https://api-m.paypal.com` |

## OAuth client credentials

```python
import base64
import os

import requests


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
```

## POST `/v2/customer/partner-referrals`

```python
def create_partner_referral(access_token: str, tracking_id: str, return_url: str) -> dict:
    body = {
        "tracking_id": tracking_id,
        "partner_config_override": {"return_url": return_url},
        "operations": [
            {
                "operation": "API_INTEGRATION",
                "api_integration_preference": {
                    "rest_api_integration": {
                        "integration_method": "PAYPAL",
                        "integration_type": "THIRD_PARTY",
                        "third_party_details": {
                            "features": ["PAYMENT", "REFUND", "PARTNER_FEE"],
                        },
                    }
                },
            }
        ],
        "products": ["EXPRESS_CHECKOUT"],
        "legal_consents": [{"type": "SHARE_DATA_CONSENT", "granted": True}],
    }
    r = requests.post(
        f"{paypal_base()}/v2/customer/partner-referrals",
        headers={
            "Authorization": f"Bearer {access_token}",
            "Content-Type": "application/json",
        },
        json=body,
        timeout=30,
    )
    r.raise_for_status()
    return r.json()
```

Resolve the seller **`action_url`** from **`links`** (`rel`: **`action_url`**) and redirect the seller there.

## Check onboarding status

```python
def merchant_integration_status(
    access_token: str, partner_id: str, merchant_id: str
) -> dict:
    r = requests.get(
        f"{paypal_base()}/v1/customer/partners/{partner_id}/merchant-integrations/{merchant_id}",
        headers={"Authorization": f"Bearer {access_token}"},
        timeout=30,
    )
    r.raise_for_status()
    return r.json()
```

Key fields typically include **`payments_receivable`**, **`primary_email_confirmed`**, and **`oauth_integrations`**. Only route live payments after your checks pass.

## Notes

- Use a unique **`tracking_id`** per seller attempt for correlation.
- Store **`merchant_id`** (seller) securely after onboarding for **`PayPal-Auth-Assertion`** on orders.
