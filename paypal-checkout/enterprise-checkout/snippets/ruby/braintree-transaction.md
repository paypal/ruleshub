# Braintree transactions — `gateway.transaction.sale`, void, refund

After the client returns a **payment method nonce** (Drop-in, Hosted Fields, or 3DS), settle funds with **`Braintree::Gateway#transaction.sale`**. Use **`void`** for unsettled authorizations and **`refund`** for settled captures.

## Sale (authorize + optional settlement)

```ruby
# frozen_string_literal: true

result = braintree_gateway.transaction.sale(
  amount: "10.00",
  payment_method_nonce: params["payment_method_nonce"],
  options: {
    submit_for_settlement: true
  },
  device_data: params["device_data"] # optional fraud / device fingerprint
)

if result.success?
  txn = result.transaction
  # txn.id — store for support and refunds
else
  # see error-handling.md
  raise result.message
end
```

### Authorize only (capture later)

```ruby
result = braintree_gateway.transaction.sale(
  amount: "10.00",
  payment_method_nonce: nonce,
  options: {
    submit_for_settlement: false
  }
)
```

## Void — unsettled authorization

```ruby
result = braintree_gateway.transaction.void(transaction_id)

if result.success?
  # authorization released
else
  raise result.message
end
```

Use the **`id`** from the original **`transaction.sale`** response.

## Refund — settled transaction

### Full refund

```ruby
result = braintree_gateway.transaction.refund(transaction_id)

raise result.message unless result.success?
```

### Partial refund

```ruby
result = braintree_gateway.transaction.refund(transaction_id, "5.00")

raise result.message unless result.success?
```

## Sinatra — `POST /api/braintree/charge` (JSON)

```ruby
# frozen_string_literal: true

require "sinatra"
require "sinatra/json"
require "json"

post "/api/braintree/charge" do
  payload = JSON.parse(request.body.read)
  nonce = payload["paymentMethodNonce"] || payload["payment_method_nonce"]
  amount = payload["amount"] || "10.00"

  result = braintree_gateway.transaction.sale(
    amount: amount,
    payment_method_nonce: nonce,
    device_data: payload["deviceData"] || payload["device_data"],
    options: { submit_for_settlement: true }
  )

  if result.success?
    json transactionId: result.transaction.id, status: result.transaction.status
  else
    status 422
    json error: result.message
  end
end
```

## Rails notes

- Put **`transaction.sale`** / **`void`** / **`refund`** in a service object; persist **`transaction.id`** on your order model.
- Use idempotency keys at your app layer if the client may retry POSTs.

## Related snippets

- `drop-in-ui-integration.md` / `hosted-fields-integration.md` — nonce source
- `braintree-vault.md` — `payment_method_token` instead of nonce
- `error-handling.md`
