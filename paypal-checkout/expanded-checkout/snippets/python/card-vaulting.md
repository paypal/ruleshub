# Card vaulting — Save cards (Vault API + Orders)

Vaulting lets you **save** a card for later charges **with** a purchase (**`store_in_vault=ON_SUCCESS`**) or **without** a purchase (**setup tokens** → **payment tokens**). To charge a saved instrument, reference **`vault_id`** (payment token id) on **`payment_source.card`**.

## With purchase — `store_in_vault: ON_SUCCESS`

Include vault attributes on **create order** when the buyer consents to save the card:

```json
{
  "intent": "CAPTURE",
  "purchase_units": [
    { "amount": { "currency_code": "USD", "value": "50.00" } }
  ],
  "payment_source": {
    "card": {
      "attributes": {
        "vault": { "store_in_vault": "ON_SUCCESS" },
        "verification": { "method": "SCA_WHEN_REQUIRED" }
      }
    }
  }
}
```

Flow: buyer pays with Card Fields → on success PayPal creates a **vaulted** payment source → listen for **`VAULT.PAYMENT-TOKEN.CREATED`** (see `webhooks.md`) and persist the token **server-side** keyed to your customer.

## Without purchase — setup tokens and payment tokens

REST (Vault v3 style):

| Step | PayPal API |
|------|------------|
| Create setup token | `POST /v3/vault/setup-tokens` |
| Buyer completes card + any SCA in client flow | Card Fields + SDK per PayPal vault-no-purchase guide |
| Create payment token | `POST /v3/vault/payment-tokens` |

Example **setup token** body (shape only — align with live docs):

```json
{
  "payment_source": { "card": {} },
  "customer": { "id": "your_internal_customer_id" }
}
```

Your Flask app should expose **authenticated** routes that call PayPal with **Bearer** access tokens, same base URLs:

| Environment | Base URL |
|-------------|----------|
| Sandbox | `https://api-m.sandbox.paypal.com` |
| Production | `https://api-m.paypal.com` |

## Use saved card — `vault_id`

```json
{
  "intent": "CAPTURE",
  "purchase_units": [
    { "amount": { "currency_code": "USD", "value": "25.00" } }
  ],
  "payment_source": {
    "card": {
      "vault_id": "PASTE_PAYMENT_TOKEN_ID"
    }
  }
}
```

Server-side, map your user’s saved token to **`vault_id`**; never expose other customers’ tokens.

## Flask snippet — merge vault into create order

```python
def _card_vault_attributes(store_in_vault: bool, verification_method: str = "SCA_WHEN_REQUIRED"):
    attrs = {"verification": {"method": verification_method}}
    if store_in_vault:
        attrs["vault"] = {"store_in_vault": "ON_SUCCESS"}
    return attrs


# When building payment_source.card:
# "attributes": _card_vault_attributes(body.get("save_card") is True)
```

## Security

- Store **payment tokens** only on the **server**, encrypted at rest.
- Obtain **explicit consent** before saving cards.
- Support **delete** flows and handle **`VAULT.PAYMENT-TOKEN.DELETED`** webhooks.
