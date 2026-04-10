# 3D Secure / SCA — Expanded Checkout

3D Secure (3DS) satisfies **Strong Customer Authentication (SCA)** where required (for example PSD2 in Europe). You configure verification on **`payment_source.card.attributes.verification.method`** at **create order**; the **Card Fields SDK** runs challenges when PayPal/the issuer requires them. After **capture**, evaluate **`authentication_result`** for **risk and fulfillment** decisions.

## `SCA_WHEN_REQUIRED` vs `SCA_ALWAYS`

| Method | Behavior |
|--------|----------|
| **`SCA_WHEN_REQUIRED`** | Run 3DS when issuer, regulation, or risk rules require it. **Recommended default** for balance of security and conversion. |
| **`SCA_ALWAYS`** | Always attempt SCA / 3DS. Use when policy demands maximum authentication (may reduce conversion). |

Set in **`POST /v2/checkout/orders`** under:

```json
"payment_source": {
  "card": {
    "attributes": {
      "verification": { "method": "SCA_WHEN_REQUIRED" }
    }
  }
}
```

(See `create-order.md` for full Flask payload.)

## Checking `authentication_result` after capture

On **`POST /v2/checkout/orders/{id}/capture`**, inspect (paths may vary slightly by API version):

- **`payment_source.card.authentication_result.liability_shift`**
- **`payment_source.card.authentication_result.three_d_secure.enrollment_status`**
- **`payment_source.card.authentication_result.three_d_secure.authentication_status`**

### `liability_shift` (typical meanings)

| Value | Business hint |
|-------|-----------------|
| **YES** | Liability often shifted to issuer — stronger protection for the merchant. |
| **NO** | No shift — higher chargeback exposure; consider extra review for high-value orders. |
| **POSSIBLE** | 3DS path existed but outcome may be ambiguous — treat cautiously. |
| **UNKNOWN** | Treat like **NO** for strict policies until clarified. |

### `authentication_status` (examples)

Statuses such as **`N`** (failed) or **`R`** (rejected) mean authentication did not succeed — **do not treat** the payment as fully authenticated for SCA purposes even if capture status is `COMPLETED` (always align with your risk and legal requirements).

## Liability shift business logic (example helper)

```python
from typing import Any, Dict, Tuple

def assess_3ds_for_fulfillment(card_auth: Dict[str, Any]) -> Tuple[bool, str]:
    """
    Returns (may_fulfill, reason_code).
    Adjust to your risk policy and regulations.
    """
    if not card_auth:
        return True, "no_card_auth_in_response"

    liability = (card_auth.get("liability_shift") or "").upper()
    tds = card_auth.get("three_d_secure") or {}
    auth_st = (tds.get("authentication_status") or "").upper()

    if auth_st in ("N", "R"):
        return False, f"authentication_status_{auth_st}"

    if liability == "YES":
        return True, "liability_shift_yes"
    if liability == "NO":
        return False, "liability_shift_no"
    if liability in ("POSSIBLE", "UNKNOWN"):
        return True, f"liability_shift_{liability.lower()}_review"

    return True, "default_allow"
```

Use this **after** successful capture and **before** shipping high-value goods or provisioning digital goods, per your compliance review.

## Operational tips

- Log **3DS fields** (not PAN/CVV) for disputes and support.
- Test **sandbox** cards that trigger enrollment, frictionless, and challenge flows (see PayPal sandbox card testing docs).
- In **`create-order.md`**, keep **`payment_source.card.experience_context.return_url` / `cancel_url`** correct for redirect-based flows.
