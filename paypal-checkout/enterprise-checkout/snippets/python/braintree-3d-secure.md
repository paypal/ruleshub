# Braintree 3D Secure — client `verifyCard`, server `threeDSecureInfo` (Braintree Direct)

For **3DS**, the client runs verification (e.g. **`threeDSecure.verifyCard`**) before you tokenize or submit a sale. On the server, inspect the resulting transaction or verification payload for **`three_d_secure_info`** and **`liability_shifted`**.

## Client — `verifyCard` (pattern)

After Hosted Fields tokenize or Drop-in **`requestPaymentMethod`**, if using the 3DS add-on:

```javascript
// Pseudocode — load three-d-secure.min.js alongside client.js
threeDSecure.verifyCard(
  {
    amount: "10.00",
    nonce: payload.nonce,
    bin: payload.details.bin, // when available from Hosted Fields
    email: "buyer@example.com",
    billingAddress: { streetAddress: "...", locality: "...", region: "...", postalCode: "...", countryCodeAlpha2: "US" },
    onLookupComplete: (data, next) => next(),
  },
  (err, response) => {
    if (err) {
      console.error(err);
      return;
    }
    // Send response.nonce to Flask — enriched for 3DS
    fetch("/api/braintree/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ payment_method_nonce: response.nonce }),
    });
  }
);
```

Exact options depend on your Braintree.js version — see **Braintree 3D Secure** guide.

## Server — sale then inspect **`three_d_secure_info`**

```python
def sale_3ds(gw, nonce: str, amount: str):
    result = gw.transaction.sale(
        {
            "amount": amount,
            "payment_method_nonce": nonce,
            "options": {"submit_for_settlement": True},
        }
    )
    if not result.is_success:
        return {"ok": False, "message": result.message}

    tx = result.transaction
    info = getattr(tx, "three_d_secure_info", None)
    if info is None:
        return {"ok": True, "transaction_id": tx.id, "three_ds": None}

    return {
        "ok": True,
        "transaction_id": tx.id,
        "liability_shifted": getattr(info, "liability_shifted", None),
        "enrolled": getattr(info, "enrolled", None),
        "status": getattr(info, "status", None),
    }
```

## Liability — `liability_shifted` check

Use **`liability_shifted`** per your risk policy:

- If you require liability shift for fulfillment, only proceed when **`liability_shifted`** is **`True`** (and transaction success), subject to your card network and Braintree configuration.

```python
def require_liability_shift(result) -> bool:
    if not result.is_success:
        return False
    info = getattr(result.transaction, "three_d_secure_info", None)
    if info is None:
        return False
    return bool(getattr(info, "liability_shifted", False))
```

## Related

- `drop-in-ui-integration.md` — enable **`threeDSecure`** in Drop-in options when applicable.
