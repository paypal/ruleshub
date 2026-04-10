# Pay Later Messaging (Client-Side) — US

Display financing banners (e.g., "Pay as low as $25.00/mo") on product, cart, and checkout pages.

Source: https://docs.paypal.ai/payments/methods/pay-later/get-started

## JS SDK v6 — HTML Configuration (simplest)

Source: https://docs.paypal.ai/payments/methods/pay-later/get-started#message-configuration-examples (HTML tab)

```html
<head>
  <script src="https://www.paypal.com/web-sdk/v6/core"></script>
  <script src="https://www.paypal.com/web-sdk/v6/paypal-messages"></script>
</head>
<body>
  <paypal-message
    amount="300.00"
    currency-code="USD"
    logo-type="MONOGRAM"
    text-color="MONOCHROME"
  ></paypal-message>

  <script>
    // Option 1: Using clientId (no server-side token generation required)
    const sdkInstance = await window.paypal.createInstance({
      clientId: "YOUR_CLIENT_ID"
    });

    // Option 2: Using clientToken (requires server-side token generation)
    // const sdkInstance = await window.paypal.createInstance({ clientToken });

    const messagesInstance = sdkInstance.createPayPalMessages();

    function triggerAmountUpdate(amount) {
      const messageElement = document.querySelector('paypal-message');
      messageElement.setAttribute('amount', amount);
    }
  </script>
</body>
```

---

## JS SDK v6 — JavaScript Configuration

Source: https://docs.paypal.ai/payments/methods/pay-later/get-started#message-configuration-examples (JavaScript tab)

```html
<head>
  <script src="https://www.paypal.com/web-sdk/v6/core"></script>
  <script src="https://www.paypal.com/web-sdk/v6/paypal-messages"></script>
</head>
<body>
  <paypal-message></paypal-message>

  <script>
    // Option 1: Using clientId
    const sdkInstance = await window.paypal.createInstance({
      clientId: "YOUR_CLIENT_ID"
    });

    // Option 2: Using clientToken
    // const sdkInstance = await window.paypal.createInstance({ clientToken });

    const messagesInstance = sdkInstance.createPayPalMessages();

    const messageElement = document.querySelector('paypal-message');
    const content = await messagesInstance.fetchContent({
      amount: "300.00",
      currencyCode: "USD",
      logoType: "MONOGRAM",
      textColor: "MONOCHROME",
      onReady: (content) => messageElement.setContent(content),
    });

    function triggerAmountUpdate(amount) {
      content.update({ amount });
    }

    // Learn More — optional
    const learnMore = await messagesInstance.createLearnMore({
      presentationMode: "POPUP",
    });

    messageElement.addEventListener("paypal-message-click", (event) => {
      event.preventDefault();
      learnMore.open(event.detail.config);
    });
  </script>
</body>
```

---

## JS SDK v6 — Hybrid Configuration

Source: https://docs.paypal.ai/payments/methods/pay-later/get-started#message-configuration-examples (Hybrid tab)

```html
<head>
  <script src="https://www.paypal.com/web-sdk/v6/core"></script>
</head>
<body>
  <paypal-message amount="300.00"></paypal-message>

  <script>
    const sdkInstance = await window.paypal.createInstance({
      clientId: "YOUR_CLIENT_ID",
      components: ["paypal-messages"],
    });
    const messagesInstance = sdkInstance.createPayPalMessages({
      currencyCode: "USD",
    });

    const messageElement = document.querySelector('paypal-message');
    const content = await messagesInstance.fetchContent({
      ...messageElement.getFetchContentOptions(),
      currencyCode: "USD",
      logoType: "MONOGRAM",
      textColor: "MONOCHROME",
    });

    function triggerAmountUpdate(amount) {
      messageElement.setAttribute('amount', amount);
    }
  </script>
</body>
```

---

## JS SDK v6 — Styling with CSS

Source: https://docs.paypal.ai/payments/methods/pay-later/get-started#message-styling

```html
<head>
  <script src="https://www.paypal.com/web-sdk/v6/core"></script>
  <script src="https://www.paypal.com/web-sdk/v6/paypal-messages"></script>
</head>
<body>
  <style>
    --paypal-message-font-size: 16px;
    --paypal-message-text-align: right;
  </style>

  <paypal-message
    auto-bootstrap
    amount="300.00"
    currency-code="USD"
    logo-position="TOP"
  ></paypal-message>

  <script>
    const sdkInstance = await window.paypal.createInstance({ clientId: "YOUR_CLIENT_ID" });
    const messagesInstance = sdkInstance.createPayPalMessages();
  </script>
</body>
```

---

## JS SDK v6 — Learn More with Event Listener

Source: https://docs.paypal.ai/payments/methods/pay-later/get-started#learn-more-configuration-patterns

```html
<head>
  <script src="https://www.paypal.com/web-sdk/v6/core"></script>
  <script src="https://www.paypal.com/web-sdk/v6/paypal-messages"></script>
</head>
<body>
  <paypal-message></paypal-message>

  <script>
    const sdkInstance = await window.paypal.createInstance({ clientId: "YOUR_CLIENT_ID" });
    const messagesInstance = sdkInstance.createPayPalMessages();

    const messageElement = document.querySelector('paypal-message');
    const content = await messagesInstance.fetchContent({
      amount: "300.00",
      currencyCode: "USD",
      logoType: "MONOGRAM",
      textColor: "MONOCHROME",
      onReady: (content) => messageElement.setContent(content),
    });

    function triggerAmountUpdate(amount) {
      content.update({ amount });
    }

    const learnMore = await messagesInstance.createLearnMore({
      presentationMode: "POPUP",
    });

    messageElement.addEventListener("paypal-message-click", (event) => {
      event.preventDefault();
      learnMore.open(event.detail.config);
    });
  </script>
</body>
```

---

## JS SDK v5 — Pay Later Messaging

Source: https://developer.paypal.com/sdk/js/configuration/ (`components=messages`)

### Script tag

```html
<script src="https://www.paypal.com/sdk/js?client-id=YOUR_CLIENT_ID&components=messages"></script>
```

With buttons:

```html
<script src="https://www.paypal.com/sdk/js?client-id=YOUR_CLIENT_ID&components=buttons,messages"></script>
```

### HTML attribute method (auto-render)

```html
<div data-pp-message
  data-pp-amount="300.00"
  data-pp-style-layout="text"
  data-pp-style-logo-type="primary"
  data-pp-style-logo-position="left"
  data-pp-style-text-color="black">
</div>
```

### JavaScript method (programmatic)

```javascript
paypal.Messages({
  amount: 300,
  style: {
    layout: "text",
    logo: {
      type: "primary",
      position: "left"
    },
    text: {
      color: "black"
    }
  }
}).render("#paylater-message");
```

---

## v5 to v6 Upgrade Summary

Source: https://docs.paypal.ai/payments/methods/pay-later/upgrade

| Concept | v5 | v6 |
|---------|----|----|
| Script | Single script with `components=messages` | Two scripts: core + paypal-messages |
| Container | `<div data-pp-message>` | `<paypal-message>` web component |
| Rendering | `paypal.Messages().render()` | `sdkInstance.createPayPalMessages()` + `fetchContent()` or `auto-bootstrap` |
| Amount update | Re-render or update attribute | `content.update({ amount })` or `setAttribute('amount', newAmount)` |
| Logo type | `primary`, `alternative`, `inline`, `none` | `WORDMARK`, `MONOGRAM`, `TEXT` |
| Text color | `black`, `white`, `monochrome`, `grayscale` | `BLACK`, `WHITE`, `MONOCHROME` |
| Auth | `client-id` in script tag | `clientId` or `clientToken` in `createInstance()` |

You can upgrade Pay Later messaging independently — no need to upgrade buttons or checkout first.

---

## Common issues

| Issue | Resolution |
|-------|------------|
| Message not rendering (v5) | Add `components=messages` to script tag |
| Message not rendering (v6) | Include `paypal-messages` script or add to components array |
| No financing info showing | Set `amount` attribute — required for dynamic messaging |
| Learn More not opening (v6) | Must wire `paypal-message-click` event listener with `learnMore.open()` |
| Stale amount after cart change | Call `content.update({ amount })` or update the `amount` attribute |
