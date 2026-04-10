# Drop-in UI — Enterprise Checkout (PHP template + client JS)

**Drop-in** provides a pre-built UI for cards, PayPal, and other payment methods. Your **PHP** app serves a page that loads Braintree JS and fetches a **client token** from a PHP endpoint (see `braintree-client-token.md`).

## Flow

1. PHP renders checkout HTML.
2. Browser `POST`s to your PHP route to get `client_token`.
3. `braintree.dropin.create` mounts the UI and returns a **nonce** on submit.
4. PHP receives the nonce server-side and runs `$gateway->transaction()->sale()` (see `braintree-transaction.md`).

## PHP template (excerpt)

Serve over HTTPS in production. Replace CDN version with the version you use from [Braintree Drop-in](https://developer.paypal.com/braintree/docs/guides/drop-in/).

```php
<?php
declare(strict_types=1);
?>
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>Checkout — Drop-in</title>
  <script src="https://js.braintreegateway.com/web/3.97.1/js/client.min.js"></script>
  <script src="https://js.braintreegateway.com/web/3.97.1/js/dropin.min.js"></script>
</head>
<body>
  <form id="payment-form">
    <div id="dropin-container"></div>
    <button type="submit" id="submit-button">Pay</button>
  </form>
  <script>
    (function () {
      const form = document.getElementById('payment-form');
      const submitBtn = document.getElementById('submit-button');

      fetch('/api/braintree/client-token.php', { method: 'POST', credentials: 'same-origin' })
        .then(function (r) { return r.json(); })
        .then(function (data) {
          if (!data.client_token) throw new Error('Missing client_token');
          return braintree.client.create({ authorization: data.client_token });
        })
        .then(function (clientInstance) {
          return braintree.dropin.create({
            authorization: clientInstance.authorization,
            container: '#dropin-container',
            paypal: { flow: 'vault' }
          });
        })
        .then(function (dropinInstance) {
          form.addEventListener('submit', function (event) {
            event.preventDefault();
            submitBtn.disabled = true;
            dropinInstance.requestPaymentMethod(function (err, payload) {
              if (err) {
                console.error(err);
                submitBtn.disabled = false;
                return;
              }
              const input = document.createElement('input');
              input.type = 'hidden';
              input.name = 'payment_method_nonce';
              input.value = payload.nonce;
              form.appendChild(input);
              form.submit();
            });
          });
        })
        .catch(function (err) { console.error(err); });
    })();
  </script>
</body>
</html>
```

**Note:** If you use `braintree.client.create` first, Drop-in can also be created with `clientInstance` per current Braintree docs; the pattern above matches common examples—adjust to your SDK version.

Alternative (simpler): pass the raw client token string directly to `braintree.dropin.create({ authorization: CLIENT_TOKEN, container: '#dropin-container' })` after fetching it once.

## Simplified client JS (authorization string only)

```html
<script src="https://js.braintreegateway.com/web/3.97.1/js/client.min.js"></script>
<script src="https://js.braintreegateway.com/web/3.97.1/js/dropin.min.js"></script>
<script>
fetch('/api/braintree/client-token.php', { method: 'POST' })
  .then(function (res) { return res.json(); })
  .then(function (data) {
    return braintree.dropin.create({
      authorization: data.client_token,
      container: '#dropin-container'
    });
  })
  .then(function (dropinInstance) {
    document.querySelector('#payment-form').addEventListener('submit', function (e) {
      e.preventDefault();
      dropinInstance.requestPaymentMethod(function (err, payload) {
        if (err) return console.error(err);
        document.querySelector('#nonce').value = payload.nonce;
        e.target.submit();
      });
    });
  });
</script>
```

## Laravel — Blade view

Use `route('braintree.client-token')` for the fetch URL and `@csrf` if posting to a web route. Register a POST route that returns JSON from `BraintreeClientTokenController` (see `braintree-client-token.md`).

```blade
<form id="payment-form" method="POST" action="{{ route('checkout.process') }}">
    @csrf
    <div id="dropin-container"></div>
    <input type="hidden" name="payment_method_nonce" id="nonce" value="">
    <button type="submit">Pay</button>
</form>
```

## Server: process nonce

On `checkout.process`, read `payment_method_nonce` and call `$gateway->transaction()->sale([...])`. See `braintree-transaction.md`.

## Related snippets

- `braintree-client-token.md` — generate client tokens
- `braintree-transaction.md` — `transaction()->sale()`
