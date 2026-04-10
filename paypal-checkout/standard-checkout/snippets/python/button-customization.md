# Button customization (v5 style options vs v6 CSS)

Customize PayPal buttons for branding and layout. **v5** uses JavaScript `style` objects on `paypal.Buttons()`. **v6** uses **web components** and **CSS classes** on elements such as `<paypal-button>`.

## v5: `style` options

Pass a `style` object when rendering buttons:

```javascript
paypal
  .Buttons({
    style: {
      layout: "vertical",
      color: "gold",
      shape: "rect",
      label: "paypal",
      height: 45,
      tagline: false,
    },
    createOrder: function () {
      /* ... */
    },
    onApprove: function (data) {
      /* ... */
    },
  })
  .render("#paypal-button-container");
```

### Common v5 style keys

| Key | Purpose |
|-----|---------|
| `layout` | Stack vs side-by-side |
| `color` | Button color theme |
| `shape` | Corner style |
| `label` | Button text / intent |
| `height` | Pixel height (within allowed range) |
| `tagline` | Show/hide secondary tagline |

Refer to PayPal’s **Customize the PayPal Buttons** documentation for allowed combinations per funding source.

## v6: CSS classes

v6 exposes components (e.g. `<paypal-button>`). Apply **CSS** for layout and use documented **class names** for variants:

```html
<style>
  .checkout-actions {
    display: flex;
    flex-direction: column;
    gap: 12px;
    max-width: 400px;
  }
  paypal-button.paypal-gold {
  }
</style>

<div class="checkout-actions">
  <paypal-button id="pay-btn" class="paypal-gold" type="pay"></paypal-button>
</div>
```

Exact **class names** (`paypal-gold`, `paypal-blue`, etc.) and attributes (`type`, `shape`) are defined in the **v6 component reference** — align with the version you load from `web-sdk/v6/core`.

## Flask: external CSS

Place shared styles in `static/css/checkout.css` and link from your Jinja template:

```html
<link rel="stylesheet" href="{{ url_for('static', filename='css/checkout.css') }}" />
```

## Best practices

- Follow **PayPal brand guidelines** for logo and button usage.
- Test **contrast** and **tap targets** on mobile.
- Do not obscure the PayPal button with overlays or misleading adjacent CTAs.

## Common issues

- **Invalid style combination**: Some `label` + `color` pairs are restricted; check docs.
- **v6 styling not applying**: Ensure the web component is **defined** (SDK loaded) before relying on shadow DOM styling — use documented host classes or CSS variables from PayPal.
