# Braintree transactions — `sale`, `submit_for_settlement`, `void`, `refund` (Braintree Direct)

Use **`gateway.transaction.sale()`** for one-step capture or authorization. Use **`void()`** on unsettled authorizations, **`refund()`** on settled captures, and **`submit_for_settlement()`** when you authorized first and capture later.

Reuse **`braintree_gateway()`** from `braintree-client-token.md`.

## Sale — capture immediately (`submit_for_settlement`)

```python
def sale_capture_now(gw, nonce: str, amount: str, device_data: str | None = None):
    params = {
        "amount": amount,
        "payment_method_nonce": nonce,
        "options": {"submit_for_settlement": True},
    }
    if device_data:
        params["device_data"] = device_data
    return gw.transaction.sale(params)
```

## Sale — authorize only (capture later)

```python
def sale_authorize_only(gw, nonce: str, amount: str):
    return gw.transaction.sale(
        {
            "amount": amount,
            "payment_method_nonce": nonce,
            "options": {"submit_for_settlement": False},
        }
    )
```

## Submit for settlement — after authorization

When the sale was created with **`submit_for_settlement: False`**, settle the authorization:

```python
def capture_authorized(gw, transaction_id: str, amount: str | None = None):
    if amount is not None:
        return gw.transaction.submit_for_settlement(transaction_id, amount)
    return gw.transaction.submit_for_settlement(transaction_id)
```

(`amount` is optional for partial settlement when supported by the processor and your Braintree settings.)

## Void — unsettled authorization

```python
def void_authorization(gw, transaction_id: str):
    return gw.transaction.void(transaction_id)
```

## Refund — settled transaction

Full refund:

```python
def refund_full(gw, transaction_id: str):
    return gw.transaction.refund(transaction_id)
```

Partial refund:

```python
def refund_partial(gw, transaction_id: str, amount: str):
    return gw.transaction.refund(transaction_id, amount)
```

## Flask — minimal checkout handler

```python
from flask import jsonify, request

@app.post("/api/braintree/checkout")
def checkout():
    data = request.get_json(silent=True) or {}
    nonce = data.get("payment_method_nonce")
    device_data = data.get("device_data")
    if not nonce:
        return jsonify(error="missing_nonce"), 400

    gw = braintree_gateway()
    sale_params = {
        "amount": data.get("amount", "10.00"),
        "payment_method_nonce": nonce,
        "options": {"submit_for_settlement": True},
    }
    if device_data:
        sale_params["device_data"] = device_data

    result = gw.transaction.sale(sale_params)
    if not result.is_success:
        return jsonify(error=result.message), 400

    tx = result.transaction
    return jsonify(transaction_id=tx.id, status=tx.status)
```

## Success checks

- Always use **`result.is_success`** before reading **`result.transaction`**.
- For declines, inspect **`processor_response_code`**, **`processor_response_text`**, and **`gateway_rejection_reason`** (see `error-handling.md`).

## Related

- `braintree-vault.md` — **`store_in_vault_on_success`** on sale.
- `braintree-3d-secure.md` — 3DS-enriched nonces and **`three_d_secure_info`**.
