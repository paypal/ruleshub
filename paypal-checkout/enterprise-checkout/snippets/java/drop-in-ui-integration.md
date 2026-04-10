# Drop-in UI — Thymeleaf + client JS (Braintree Direct)

Load **Drop-in** in the browser using the **`client_token`** from `braintree-client-token.md`. Use **sandbox** Braintree JS in development; switch CDN/script URL for production per Braintree docs.

## Thymeleaf template (`templates/checkout-dropin.html`)

```html
<!DOCTYPE html>
<html xmlns:th="http://www.thymeleaf.org" lang="en">
<head>
  <meta charset="UTF-8"/>
  <title>Checkout — Drop-in</title>
  <script src="https://js.braintreegateway.com/web/dropin/1.44.1/js/dropin.min.js"></script>
</head>
<body>
  <h1>Pay with card or wallet</h1>
  <div id="dropin-container"></div>
  <button id="submit-button" type="button" disabled>Pay</button>

  <script th:inline="javascript">
    /*<![CDATA[*/
    const clientToken = /*[[${clientToken}]]*/ '';

    braintree.dropin.create({
      authorization: clientToken,
      container: '#dropin-container',
      // vaultManager: true, // if using customer_id in client token
    }, function (createErr, dropinInstance) {
      if (createErr) {
        console.error(createErr);
        return;
      }
      document.querySelector('#submit-button').disabled = false;

      document.querySelector('#submit-button').addEventListener('click', function () {
        dropinInstance.requestPaymentMethod(function (err, payload) {
          if (err) {
            console.error(err);
            return;
          }
          // POST payload.nonce to your Spring endpoint → gateway.transaction().sale()
          fetch('/api/braintree/checkout', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ payment_method_nonce: payload.nonce }),
          }).then(function (r) { return r.json(); }).then(console.log).catch(console.error);
        });
      });
    });
    /*]]>*/
  </script>
</body>
</html>
```

## Spring MVC — serve page with `clientToken`

```java
import com.braintreegateway.BraintreeGateway;
import org.springframework.stereotype.Controller;
import org.springframework.ui.Model;
import org.springframework.web.bind.annotation.GetMapping;

@Controller
public class CheckoutPageController {

  private final BraintreeGateway gateway;

  public CheckoutPageController(BraintreeGateway gateway) {
    this.gateway = gateway;
  }

  @GetMapping("/checkout/dropin")
  public String dropin(Model model) {
    String token = gateway.clientToken().generate();
    model.addAttribute("clientToken", token);
    return "checkout-dropin";
  }
}
```

## Related

- `hosted-fields-integration.md` — custom card fields instead of Drop-in.
- `braintree-transaction.md` — charge the nonce on the server.
