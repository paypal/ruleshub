# Error handling — Braintree + multiparty PayPal REST

Centralize logging with **transaction ids**, **Braintree request ids**, and PayPal **debug_id** / **correlation** headers for support tickets.

## Braintree

### `processor_declined` (typical codes 2000-series and related)

- Map **`processorResponseCode`** and **`processorResponseText`** to user-safe messages (never expose raw processor text verbatim if it leaks sensitive data).
- **2000-series** codes (and adjacent ranges, often up through **3000**) usually mean issuer/processor declines (insufficient funds, do not honor, lost/stolen card, etc.). Treat as **retry may not help** unless the buyer fixes the instrument.

### `gateway_rejected`

- Inspect **`gatewayRejectionReason`** (e.g. risk rules, AVS/CVV policy).
- Log **`transaction.id`** if present on the object, plus **`creditCardVerification` / `riskData`** when returned.

### Validation errors

- **`ValidationsError`** / `deepErrors` on failed `customer.create`, `transaction.sale`, etc.
- Iterate **`result.errors.forEach`** or `deepErrors` and return field-level messages to your UI where safe.

### Subscriptions (if used)

- Webhook kinds such as **`subscription_charged_successfully`** / **`subscription_charged_unsuccessfully`** (see `webhooks.md`) — correlate with **`subscription.id`** in the webhook subject for dunning and entitlement updates.

### Logging checklist

- Braintree **`transaction.id`**
- **`processorResponseCode`** / **`processorResponseText`**
- **`gatewayRejectionReason`**
- Correlation from Braintree SDK error if exposed

## Multiparty / PayPal REST

### Auth failures

- **401** — refresh OAuth token; verify `PAYPAL_CLIENT_ID` / `PAYPAL_CLIENT_SECRET` and environment (sandbox vs production).
- **403** — missing scopes or partner permissions; confirm app is enabled for multiparty features.

### Seller not consented / onboarding incomplete

- **`payments_receivable`** false on merchant integration — block captures; re-run onboarding (`seller-onboarding.md`).

### Platform fee errors

- Currency mismatch with transaction or payee configuration.
- Fee amount exceeds allowed split — compare against PayPal multiparty rules and purchase unit totals.
- **Unprocessable entity** — read **`details`** array in error JSON.

### PayPal error JSON (axios)

Error bodies often include **`name`**, **`message`**, **`details`** (array of **`issue`**, **`field`**, **`description`**). Platform fee and seller errors frequently appear under **`details`** with **`422`** / **`400`**.

```javascript
try {
  await axios.post(/* ... */);
} catch (err) {
  if (err.response) {
    console.error('PayPal error', {
      status: err.response.status,
      data: err.response.data,
      debugId: err.response.headers['paypal-debug-id'],
    });
  } else {
    console.error(err.message);
  }
}
```

Always log **`paypal-debug-id`** from response headers when present (support will ask for it).

## Client vs server messaging

- **Server** decides whether a decline is retryable; **client** shows generic failure + support reference id, not raw processor codes in production unless you have a curated mapping.
