# Braintree client token — Ruby (`gateway.client_token.generate`) + Sinatra GET

The browser needs a **client token** (or authorization string) to initialize `braintree.client`, Drop-in, and Hosted Fields. Generate it server-side with **`Braintree::Gateway#client_token.generate`**.

## Gateway helper

```ruby
# frozen_string_literal: true

require "braintree"

def braintree_gateway
  @braintree_gateway ||= Braintree::Gateway.new(
    environment: braintree_environment,
    merchant_id: ENV.fetch("BRAINTREE_MERCHANT_ID"),
    public_key: ENV.fetch("BRAINTREE_PUBLIC_KEY"),
    private_key: ENV.fetch("BRAINTREE_PRIVATE_KEY")
  )
end

def braintree_environment
  ENV.fetch("BRAINTREE_ENVIRONMENT", "sandbox").downcase == "production" ? :production : :sandbox
end
```

## Sinatra — GET `/api/braintree/client-token`

```ruby
# frozen_string_literal: true

require "sinatra"
require "sinatra/json"
require "json"

get "/api/braintree/client-token" do
  result = braintree_gateway.client_token.generate(
    # Optional: customer_id for vault / returning shoppers
    # customer_id: params["customer_id"]
  )

  json clientToken: result
rescue Braintree::BraintreeError => e
  status 500
  json error: e.message
end
```

### With optional `customer_id` (vaulted customer)

```ruby
get "/api/braintree/client-token" do
  opts = {}
  opts[:customer_id] = params["customer_id"] unless params["customer_id"].to_s.empty?

  token = braintree_gateway.client_token.generate(opts)
  json clientToken: token
end
```

(If you use `present?`, add Active Support or use `!params["customer_id"].to_s.empty?` in plain Ruby.)

## Client usage

The front end fetches this route and passes `clientToken` to `braintree.client.create` or Drop-in / Hosted Fields — see `drop-in-ui-integration.md` and `hosted-fields-integration.md`.

## Rails notes

- Expose the same logic in a **`ClientTokensController#show`** or **`Api::Braintree::ClientTokensController`**.
- Cache is usually **not** applied to client tokens; generate per session or per checkout load.

## Related snippets

- `drop-in-ui-integration.md`
- `hosted-fields-integration.md`
- `braintree-vault.md` — when using `customer_id` on the token
