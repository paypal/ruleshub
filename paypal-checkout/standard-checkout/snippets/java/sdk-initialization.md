# SDK initialization — PayPal Standard Checkout (HTML / JS + Thymeleaf)

Client-side patterns are **the same for any server language** (Java, Node, Python, etc.). The server exposes REST endpoints; the browser loads the PayPal JS SDK and calls your backend to create/capture orders when using **v6** server-side order creation.

## Load the SDK

**Sandbox**

```html
<script
  src="https://www.paypal.com/sdk/js?client-id=YOUR_CLIENT_ID&currency=USD"
></script>
```

**Live**

```html
<script
  src="https://www.paypal.com/sdk/js?client-id=YOUR_CLIENT_ID&currency=USD"
></script>
```

Replace `YOUR_CLIENT_ID` with your Sandbox or Live client ID. Add `&buyer-country=US` or other [query parameters](https://developer.paypal.com/sdk/js/configuration/) as needed.

## v6 — server creates order (recommended)

Flow: **render buttons** → **create order** calls your Spring endpoint → **onApprove** calls your capture endpoint.

```html
<div id="paypal-button-container"></div>
<script src="https://www.paypal.com/sdk/js?client-id=YOUR_CLIENT_ID&currency=USD"></script>
<script>
  paypal.Buttons({
    createOrder: async () => {
      const res = await fetch('/paypal-api/checkout/orders/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          intent: 'CAPTURE',
          purchase_units: [{
            amount: { currency_code: 'USD', value: '10.00' }
          }]
        })
      });
      if (!res.ok) throw new Error('create order failed');
      const data = await res.json();
      return data.id;
    },
    onApprove: async (data) => {
      const res = await fetch(
        '/paypal-api/checkout/orders/' + encodeURIComponent(data.orderID) + '/capture',
        { method: 'POST' }
      );
      if (!res.ok) throw new Error('capture failed');
      const details = await res.json();
      console.log('Capture:', details);
    },
    onError: (err) => console.error(err)
  }).render('#paypal-button-container');
</script>
```

## v5 — `actions.order.create` (client-side order)

Legacy pattern; some apps still use it. Order JSON is built in the browser.

```html
<div id="paypal-button-container"></div>
<script src="https://www.paypal.com/sdk/js?client-id=YOUR_CLIENT_ID&currency=USD"></script>
<script>
  paypal.Buttons({
    createOrder: function (data, actions) {
      return actions.order.create({
        purchase_units: [{
          amount: { value: '10.00' }
        }]
      });
    },
    onApprove: function (data, actions) {
      return actions.order.capture().then(function (details) {
        console.log('Captured:', details);
      });
    }
  }).render('#paypal-button-container');
```

For **v6** production apps, prefer **server-side** `createOrder` + `capture` for PCI and control over amounts.

## Thymeleaf template example

`src/main/resources/templates/checkout.html`:

```html
<!DOCTYPE html>
<html xmlns:th="http://www.thymeleaf.org" lang="en">
<head>
  <meta charset="UTF-8"/>
  <title>Checkout</title>
  <script th:src="@{https://www.paypal.com/sdk/js(client-id=${paypalClientId}, currency='USD')}"></script>
</head>
<body>
  <div id="paypal-button-container"></div>
  <script th:inline="javascript">
    const createUrl = /*[[@{/paypal-api/checkout/orders/create}]]*/ '/paypal-api/checkout/orders/create';
    paypal.Buttons({
      createOrder: async () => {
        const res = await fetch(createUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            intent: 'CAPTURE',
            purchase_units: [{
              amount: { currency_code: 'USD', value: '10.00' }
            }]
          })
        });
        const data = await res.json();
        return data.id;
      },
      onApprove: async (data) => {
        const captureUrl = createUrl.replace('/create', '') + '/' + encodeURIComponent(data.orderID) + '/capture';
        await fetch(captureUrl, { method: 'POST' });
      }
    }).render('#paypal-button-container');
  </script>
</body>
</html>
```

Controller model:

```java
@GetMapping("/checkout")
public String checkout(Model model, @Value("${paypal.client-id}") String clientId) {
  model.addAttribute("paypalClientId", clientId);
  return "checkout";
}
```

Add `spring-boot-starter-thymeleaf` if you use Thymeleaf.

## Environment alignment

Use the **same** Sandbox vs Live **client ID** as your server credentials (`PAYPAL_MODE`). Mismatch causes order or capture failures.

## Related snippets

- Server order creation: `create-order.md`
- Capture: `capture-order.md`
- Pay Later / Venmo: `pay-later-integration.md`, `venmo-integration.md`
