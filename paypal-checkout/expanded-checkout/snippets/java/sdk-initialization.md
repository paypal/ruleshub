# SDK initialization — PayPal Expanded Checkout (Thymeleaf + HTML/JS)

Load the PayPal JS SDK with **Card Fields**, then initialize using your **client token** from `client-token-generation.md`. Examples cover **JS SDK v6** and **v5**.

**REST bases (server-side only):** Sandbox `https://api-m.sandbox.paypal.com`, Production `https://api-m.paypal.com`.

## Thymeleaf template (`checkout.html`)

```html
<!DOCTYPE html>
<html xmlns:th="http://www.thymeleaf.org" lang="en">
<head>
  <meta charset="UTF-8"/>
  <title>Expanded Checkout</title>
  <!-- v6 (sandbox) — use www.paypal.com/web-sdk/v6/core in production -->
  <script src="https://www.sandbox.paypal.com/web-sdk/v6/core"></script>
  <!-- v5 alternative:
  <script th:src="|https://www.sandbox.paypal.com/sdk/js?client-id=${paypalClientId}&components=buttons,card-fields|"></script>
  -->
</head>
<body>
  <div id="paypal-buttons"></div>
  <div id="card-fields-container"></div>

  <script th:inline="javascript">
    const CLIENT_ID = /*[[${paypalClientId}]]*/ '';

    async function getClientToken() {
      const res = await fetch('/api/paypal/client-token');
      const data = await res.json();
      return data.client_token;
    }

    // --- JS SDK v6 ---
    (async () => {
      const clientToken = await getClientToken();
      const sdkInstance = await window.paypal.createInstance({
        clientId: CLIENT_ID,
        clientToken: clientToken,
        components: ['paypal-payments', 'card-fields'],
        pageType: 'checkout'
      });
      await sdkInstance.findEligibleMethods({ currencyCode: 'USD' });
      // Render buttons / card fields per card-fields-integration.md
    })();
  </script>
</body>
</html>
```

## Controller — pass Client ID (public) to the template

```java
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Controller;
import org.springframework.ui.Model;
import org.springframework.web.bind.annotation.GetMapping;

@Controller
public class CheckoutPageController {

  @Value("${paypal.client-id}")
  private String paypalClientId;

  @GetMapping("/checkout")
  public String checkout(Model model) {
    model.addAttribute("paypalClientId", paypalClientId);
    return "checkout";
  }
}
```

## v5 minimal inline (reference)

```html
<script src="https://www.sandbox.paypal.com/sdk/js?client-id=YOUR_CLIENT_ID&components=buttons,card-fields"></script>
```

Then use `paypal.Buttons({ ... })` and `paypal.CardFields({ ... })` as in `card-fields-integration.md`.

## Notes

- **v6:** `createInstance` with `components` including `card-fields` (and `paypal-payments` for wallet buttons).
- **Client token:** Fetch from Spring `GET /api/paypal/client-token` (`client-token-generation.md`).
- Switch sandbox script hosts to production (`www.paypal.com`) when live.
