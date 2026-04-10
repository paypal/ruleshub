# Card Fields integration (client-side)

Card Fields keep **raw card data out of your servers** — PayPal hosts inputs in secure contexts. Your page **styles** fields and handles **validation events** and **submit**. Pair with server routes from **`create-order.md`** and **`capture-order.md`**.

## PCI scope note

Using Card Fields aligns with PayPal’s PCI DSS scope for the integration. **Do not** read or log card numbers/CVV from the DOM. Show a PayPal **payment methods** disclosure as required (see PayPal Expanded Checkout docs).

---

## v6 — card payment session (pattern)

After `createInstance({ clientToken, components: ["paypal-payments", "card-fields"], ... })`, follow PayPal’s **v6 Card Fields** guide to:

1. Obtain a **card fields** session / component from `sdkInstance` (API names may be `createCardFields` or similar per current SDK — use the version pinned in your integration).
2. **Render** number, expiry, CVV (and optional name) into container elements.
3. Subscribe to **change / blur** events to enable the Pay button and show inline errors.
4. On submit, call the session **submit** method so PayPal tokenizes and runs **3D Secure** when required, then resolves with an **order ID** for your server capture.

Illustrative structure (pseudo-API — align with your SDK version):

```javascript
// After sdkInstance is ready
const eligible = await sdkInstance.findEligibleMethods?.();
if (!eligible?.cardFields) {
  // hide card UI or message
}

const cardFields = await sdkInstance.createCardFields({
  // styling: see below
  style: {
    input: { "font-size": "16px", color: "#222" },
    ".invalid": { color: "#c23d4b" },
  },
});

await cardFields.NumberField().render("#card-number-container");
await cardFields.ExpiryField().render("#card-expiry-container");
await cardFields.CVVField().render("#card-cvv-container");

cardFields.on("change", (event) => {
  document.getElementById("card-pay").disabled = !event.isFormValid;
});

document.getElementById("card-pay").addEventListener("click", async () => {
  const result = await cardFields.submit({
    createOrder: () =>
      fetch("/paypal-api/checkout/orders/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: "10.00",
          currency_code: "USD",
          funding_source: "card",
        }),
      }).then((r) => r.json()),
  });
  await fetch(`/paypal-api/checkout/orders/${result.orderID}/capture`, {
    method: "POST",
  });
});
```

Wire **`createOrder`** to your Flask **`POST /paypal-api/checkout/orders/create`** that sends **`payment_source.card`** with **`attributes.verification.method`** (see `create-order.md`).

---

## v5 — `paypal.CardFields`

```javascript
const cardFields = paypal.CardFields({
  style: {
    input: { "font-size": "16px", color: "#333" },
    ".invalid": { color: "#c23d4b" },
  },
  createOrder: function () {
    return fetch("/paypal-api/checkout/orders/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        amount: "10.00",
        currency_code: "USD",
        funding_source: "card",
      }),
    })
      .then((r) => r.json())
      .then((data) => data.id);
  },
  onApprove: function (data) {
    return fetch(`/paypal-api/checkout/orders/${data.orderID}/capture`, {
      method: "POST",
    }).then((r) => r.json());
  },
  onError: function (err) {
    console.error(err);
  },
});

if (cardFields.isEligible()) {
  cardFields.NumberField().render("#card-number");
  cardFields.ExpiryField().render("#card-expiry");
  cardFields.CVVField().render("#card-cvv");
  cardFields.NameField().render("#card-name");
}

document.getElementById("pay-card").addEventListener("click", function () {
  cardFields.submit();
});
```

---

## Styling

Pass a **`style`** object supported by your SDK version (common keys: `input`, placeholders, `.invalid`, borders, fonts). Prefer **≥16px** font size on mobile to reduce zoom quirks.

---

## Validation events

- Use **`onChange`** / field callbacks to toggle the submit button and show **field-level** errors.
- Do **not** validate raw PAN — only **form completeness** and SDK-reported validity.

---

## Best practices

- Call **`isEligible()`** (v5) or equivalent (v6) before showing card UI.
- Keep **amount/currency** on the server authoritative; client only displays what the server will charge.
- Handle **`onError`** / rejected submit with user-safe messages; log **`PayPal-Debug-Id`** only from server responses.
