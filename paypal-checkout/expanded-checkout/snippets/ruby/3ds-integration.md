# 3D Secure — Expanded Checkout (Ruby server + JS SDK)

3D Secure (SCA) is triggered when required based on **`payment_source.card.attributes.verification.method`** (e.g. **`SCA_WHEN_REQUIRED`**) on **create order**, region, and issuer rules. The **JS SDK** drives the challenge UI; your **Ruby** server creates orders and captures when the client completes the flow.

REST hosts:

| Environment | Base URL |
|-------------|----------|
| Sandbox | `https://api-m.sandbox.paypal.com` |
| Production | `https://api-m.paypal.com` |

---

## Server: order creation (no `application_context`)

Use **`payment_source.card`** with **`experience_context`** and verification — same as **`create-order.md`**:

```ruby
payment_source: {
  card: {
    experience_context: {
      return_url: "#{base_url}/checkout/return",
      cancel_url: "#{base_url}/checkout/cancel"
    },
    attributes: {
      verification: {
        method: "SCA_WHEN_REQUIRED" # or SCA_ALWAYS
      }
    }
  }
}
```

---

## Client: let the SDK handle the challenge

With **Card Fields**, do **not** build your own 3DS iframe. After `createOrder`, the SDK may open the step-up; your **`onApprove`** (or v6 equivalent) runs when authentication and approval succeed.

```javascript
// Pseudocode — follow current v5/v6 Card Fields docs
cardFields.onApprove = async (data) => {
  const res = await fetch(`/paypal-api/checkout/orders/${data.orderID}/capture`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '{}',
  });
  return res.json();
};
```

---

## Server: after capture — read authentication result

Parse **`purchase_units[].payments.captures[]`** for **`payment_source.card.authentication_result`** (names may vary slightly). Your **`capture-order.md`** snippet shows a simple extractor.

```ruby
def sca_status_from_capture(json)
  cap = json.dig("purchase_units", 0, "payments", "captures", 0)
  cap&.dig("payment_source", "card", "authentication_result")
end
```

Use this for logging, risk review, and support — not as sole proof of delivery.

---

## Sinatra: optional GET return handler

Some flows redirect to **`return_url`** after challenge. Ensure a route exists that either:

- Completes capture if not yet done, or
- Shows a “processing” page that polls your backend order state.

```ruby
get "/checkout/return" do
  order_id = params[:token] # PayPal may pass token / PayerID depending on flow; confirm with live tests
  erb :checkout_return, locals: { order_id: order_id }
end
```

Adjust query params per the Orders API and SDK version you use.

---

## Rails notes

- Store **`order_id`** server-side with your cart id before redirect.
- Use **ActiveJob** for async capture if your flow allows, but many teams capture synchronously from `onApprove` for simplicity.

## Best practices

- Prefer **`SCA_WHEN_REQUIRED`** unless regulations require **`SCA_ALWAYS`**.
- Test with [sandbox negative scenarios](https://developer.paypal.com/tools/sandbox/negative-testing/) and European test cards.

## Common issues

| Issue | Fix |
|-------|-----|
| Challenge loops | Ensure same `order_id` through create → approve → capture |
| Missing return URL | Include **`experience_context.return_url`** under **`payment_source.card`** |
