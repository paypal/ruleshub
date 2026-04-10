# Hosted Fields — Enterprise Checkout (PHP template + client JS)

**Hosted Fields** embeds iframes for card number, expiration, and CVV so raw card data never touches your server (PCI-friendly). Your **PHP** app serves HTML, exposes a **client token** endpoint, and on POST runs **`$gateway->transaction()->sale()`** with the nonce.

## PHP template (excerpt)

Same pattern as Drop-in: a `.php` page outputs the form shell and scripts; **`fetch`** loads the token from your PHP route.

```php
<?php
declare(strict_types=1);
?>
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>Checkout — Hosted Fields</title>
  <script src="https://js.braintreegateway.com/web/3.97.1/js/client.min.js"></script>
  <script src="https://js.braintreegateway.com/web/3.97.1/js/hosted-fields.min.js"></script>
</head>
<body>
  <form id="checkout-form" action="/checkout/process.php" method="POST">
    <label>Card number</label>
    <div id="card-number" class="hosted-field"></div>
    <label>Expiration</label>
    <div id="expiration-date" class="hosted-field"></div>
    <label>CVV</label>
    <div id="cvv" class="hosted-field"></div>
    <input type="hidden" name="payment_method_nonce" id="payment_method_nonce">
    <button type="submit" id="submit">Pay</button>
  </form>
  <!-- Client JS below -->
</body>
</html>
```

## Scripts

Load `client.min.js` and `hosted-fields.min.js` from Braintree’s CDN (version per [Hosted Fields guide](https://developer.paypal.com/braintree/docs/guides/hosted-fields/)).

## Client JS — create client, hosted fields, tokenize

```html
<form id="checkout-form" action="/checkout/process.php" method="POST">
  <label>Card number</label>
  <div id="card-number" class="hosted-field"></div>
  <label>Expiration</label>
  <div id="expiration-date" class="hosted-field"></div>
  <label>CVV</label>
  <div id="cvv" class="hosted-field"></div>
  <input type="hidden" name="payment_method_nonce" id="payment_method_nonce">
  <button type="submit" id="submit">Pay</button>
</form>

<script src="https://js.braintreegateway.com/web/3.97.1/js/client.min.js"></script>
<script src="https://js.braintreegateway.com/web/3.97.1/js/hosted-fields.min.js"></script>
<script>
(function () {
  var form = document.querySelector('#checkout-form');
  var submitBtn = document.querySelector('#submit');

  fetch('/api/braintree/client-token.php', { method: 'POST', credentials: 'same-origin' })
    .then(function (res) { return res.json(); })
    .then(function (data) {
      return braintree.client.create({ authorization: data.client_token });
    })
    .then(function (clientInstance) {
      return braintree.hostedFields.create({
        client: clientInstance,
        styles: {
          input: { 'font-size': '16px', color: '#333' },
          '.invalid': { color: '#c00' }
        },
        fields: {
          number: { selector: '#card-number', placeholder: '4111 1111 1111 1111' },
          expirationDate: { selector: '#expiration-date', placeholder: 'MM/YYYY' },
          cvv: { selector: '#cvv', placeholder: '123' }
        }
      });
    })
    .then(function (hostedFieldsInstance) {
      form.addEventListener('submit', function (event) {
        event.preventDefault();
        submitBtn.disabled = true;
        hostedFieldsInstance.tokenize(function (tokenizeErr, payload) {
          if (tokenizeErr) {
            console.error(tokenizeErr);
            submitBtn.disabled = false;
            return;
          }
          document.querySelector('#payment_method_nonce').value = payload.nonce;
          form.submit();
        });
      });
    })
    .catch(function (err) { console.error(err); });
})();
</script>
```

## 3D Secure

If you use Braintree 3DS with Hosted Fields, follow `braintree-3d-secure.md` to add `threeDSecure` and verify `threeDSecureInfo` on the server.

## Laravel

Same JS in a Blade view; point `fetch()` to `route('braintree.client-token')` (POST). Process `payment_method_nonce` in a Laravel controller with `Braintree\Gateway`.

## Related snippets

- `braintree-client-token.md` — PHP client token endpoint
- `braintree-transaction.md` — sale with nonce
- `braintree-3d-secure.md` — 3DS
