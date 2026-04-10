# Error handling — Braintree + multiparty PayPal REST

Centralize logging with **transaction ids**, Braintree correlation where available, and PayPal **`paypal-debug-id`** / response **`details`** for support.

## Braintree

### `processor_declined` (typical codes 2000–2999)

- Map **`processor_response_code`** and **`processor_response_text`** to user-safe messages (avoid echoing raw processor text if it may leak sensitive data).
- Codes in the **2000–2999** range often indicate issuer/processor declines (insufficient funds, do not honor, etc.). Treat as **retry may not help** unless the buyer changes the instrument.

### `gateway_rejected`

- Inspect **`gateway_rejection_reason`** (risk rules, AVS/CVV policy, etc.).
- Log **`transaction.id`** when present, plus verification / risk payloads returned on the result.

### Validation errors

- On failed **`customer.create`**, **`transaction.sale`**, etc., inspect **`result.errors`** / deep errors on the result object.
- Return field-level messages to your UI only when safe (no internal stack traces).

### Python — transaction sale failure

```python
def log_braintree_failure(result):
    if result.is_success:
        return
    tx = result.transaction
    parts = [result.message]
    if tx:
        parts.append(getattr(tx, "id", None))
        parts.append(getattr(tx, "processor_response_code", None))
        parts.append(getattr(tx, "processor_response_text", None))
        parts.append(getattr(tx, "gateway_rejection_reason", None))
    # Log server-side; return generic message to client
    print("braintree_failure", parts)
```

## Multiparty / PayPal REST

### Auth failures

- **401** — refresh OAuth token; verify **`PAYPAL_CLIENT_ID`** / **`PAYPAL_CLIENT_SECRET`** and sandbox vs production base URL.
- **403** — missing scopes or partner permissions; confirm the REST app is enabled for multiparty features.

### Seller not consented / onboarding incomplete

- **`payments_receivable`** false on merchant integration — block captures; re-run onboarding (`seller-onboarding.md`).

### Platform fee errors

- Currency mismatch with transaction or payee configuration.
- Fee amount exceeds allowed split — compare against PayPal multiparty rules and purchase unit totals.
- **422 Unprocessable Entity** — read **`details`** array in the error JSON body.

### `requests` — log PayPal errors

```python
import requests


def paypal_post(url: str, **kwargs) -> requests.Response:
    r = requests.post(url, **kwargs)
    if not r.ok:
        debug_id = r.headers.get("paypal-debug-id")
        try:
            data = r.json()
        except ValueError:
            data = r.text
        print("PayPal error", r.status_code, debug_id, data)
    return r
```

Always log **`paypal-debug-id`** from response headers when present.

## Client vs server messaging

- **Server** decides whether a decline is retryable; **client** shows a generic failure plus a support reference id, not raw processor codes in production unless you maintain a curated mapping.
