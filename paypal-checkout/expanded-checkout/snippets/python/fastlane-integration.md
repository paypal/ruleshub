# Fastlane integration (client JS)

**Fastlane** accelerates guest checkout by recognizing returning buyers after **email lookup** and optional **authentication**. Load the **`fastlane`** component with the same **browser-safe client token** pattern as Card Fields. Server routes remain standard **`POST /v2/checkout/orders`** and **`POST /v2/checkout/orders/{id}/capture`**.

## Initialization (v6 pattern)

```javascript
async function initFastlane() {
  const clientToken = await fetch("/paypal-api/auth/browser-safe-client-token")
    .then((r) => r.json())
    .then((d) => d.client_token);

  const sdkInstance = await window.paypal.createInstance({
    clientToken,
    components: ["fastlane", "paypal-payments", "card-fields"],
    pageType: "checkout",
  });

  const fastlane = await sdkInstance.createFastlane();

  const emailInput = document.getElementById("buyer-email");
  emailInput.addEventListener("blur", async () => {
    const email = emailInput.value.trim();
    if (!email) return;

    const { customerContextId } = await fastlane.identity.lookupCustomerByEmail(email);

    if (customerContextId) {
      const authResult = await fastlane.identity.triggerAuthenticationFlow(customerContextId);
      const profile = authResult.profileData;
      // Use profile shipping, name, and saved card hints per PayPal docs
    } else {
      const waterfall = await fastlane.FastlaneWaterfallComponent({
        /* options per current SDK */
      });
      await waterfall.render("#fastlane-card-container");
    }
  });
}
```

## API surface (names per integration mapping)

| Step | Typical call |
|------|----------------|
| Email capture | User enters email on your page |
| Lookup | `fastlane.identity.lookupCustomerByEmail(email)` → `customerContextId` |
| Auth | `fastlane.identity.triggerAuthenticationFlow(customerContextId)` |
| New buyers | `FastlaneWaterfallComponent({ ... })` → `render('#container')` |

Exact method names and return shapes follow the **SDK version** you load; verify against PayPal **Fastlane** documentation for that version.

## Server (Flask)

- **`GET /paypal-api/auth/browser-safe-client-token`** — unchanged; token must be valid for Fastlane-enabled REST app configuration.
- **`POST /paypal-api/checkout/orders/create`** — same Orders API as Expanded Checkout.
- **`POST /paypal-api/checkout/orders/<id>/capture`** — same capture route.

## Best practices

- Place **email** early in checkout to allow lookup before payment method selection.
- Show **loading** state during lookup and authentication.
- If Fastlane is **not eligible**, fall back to standard **Card Fields** (see `card-fields-integration.md`).
