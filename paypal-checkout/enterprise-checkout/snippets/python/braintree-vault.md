# Braintree vault — customers, `payment_method_token` (Braintree Direct)

Store payment methods with **`gateway.customer.create`**, **`customer.find`**, and **`payment_method_token`** for future charges. You can vault **during** **`transaction.sale`** or **without** a transaction using **`credit_card` / nonce** and **`verify_card`** options.

## Create customer

```python
def create_customer(gw, merchant_customer_id: str, email: str | None = None):
    params = {"id": merchant_customer_id}
    if email:
        params["email"] = email
    return gw.customer.create(params)
```

Use a stable **id** you control (your user id) as **`merchant_customer_id`** or let Braintree assign an id and store it.

## Find customer (with vaulted payment methods)

```python
def find_customer(gw, customer_id: str):
    return gw.customer.find(customer_id)
```

## Vault with transaction — `options.store_in_vault_on_success`

```python
def sale_and_vault(gw, nonce: str, amount: str, customer_id: str):
    return gw.transaction.sale(
        {
            "amount": amount,
            "payment_method_nonce": nonce,
            "customer_id": customer_id,
            "options": {
                "submit_for_settlement": True,
                "store_in_vault_on_success": True,
            },
        }
    )
```

On success, the payment method is available under the customer; use **`transaction.payment_method_token`** for the token string when present.

## Vault without a separate transaction — `payment_method.create`

```python
def vault_nonce(gw, customer_id: str, nonce: str):
    return gw.payment_method.create(
        {
            "customer_id": customer_id,
            "payment_method_nonce": nonce,
            "options": {"verify_card": True},
        }
    )
```

## Charge vaulted **`payment_method_token`**

```python
def charge_token(gw, payment_method_token: str, amount: str):
    return gw.transaction.sale(
        {
            "amount": amount,
            "payment_method_token": payment_method_token,
            "options": {"submit_for_settlement": True},
        }
    )
```

## Related

- `braintree-client-token.md` — pass **`customer_id`** into **`client_token.generate`** for Drop-in to show saved methods.
