# Braintree vault — `gateway.customer.create`, `gateway.payment_method.create`, saved token

Vaulting stores a reusable **payment method token** for a **customer**. Use **`customer.create`**, then **`payment_method.create`** with the nonce, or pass **`customer_id`** and vault options on **`transaction.sale`**.

## Create customer

```ruby
# frozen_string_literal: true

result = braintree_gateway.customer.create(
  first_name: "Jane",
  last_name: "Buyer",
  email: "jane@example.com",
  id: nil # optional: your own customer id if supported by your flow
)

if result.success?
  customer_id = result.customer.id
else
  raise result.message
end
```

## Create payment method from nonce (saved token)

```ruby
result = braintree_gateway.payment_method.create(
  customer_id: customer_id,
  payment_method_nonce: nonce_from_client,
  options: {
    verify_card: true,
    make_default: true
  }
)

if result.success?
  token = result.payment_method.token # use for future charges
else
  raise result.message
end
```

## Charge a saved token

```ruby
result = braintree_gateway.transaction.sale(
  amount: "15.00",
  payment_method_token: token
)
```

## Vault on first sale (alternative)

```ruby
result = braintree_gateway.transaction.sale(
  amount: "10.00",
  payment_method_nonce: nonce,
  customer_id: customer_id,
  options: {
    submit_for_settlement: true,
    store_in_vault_on_success: true
  }
)
```

## Client token for vaulted customer

When generating the client token, pass **`customer_id`** so Drop-in / Hosted Fields can show saved methods — see `braintree-client-token.md`.

## Rails notes

- Associate **`customer_id`** / Braintree **`customer.id`** with your **`User`** or **`Account`** model in your database.
- Do not log full payment method tokens in plain text in production logs; treat them like sensitive credentials.

## Related snippets

- `braintree-client-token.md`
- `braintree-transaction.md`
