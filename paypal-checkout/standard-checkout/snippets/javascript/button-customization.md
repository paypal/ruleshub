# Button Customization — Standard Checkout

Customize PayPal, Pay Later, and Venmo buttons for layout, branding, and responsiveness. **v5** uses the JavaScript `style` object; **v6** uses **web components** and **CSS** classes on those components.

## JS SDK v5 — `style` options

```javascript
paypal
  .Buttons({
    style: {
      layout: 'vertical', // 'vertical' | 'horizontal'
      color: 'gold', // 'gold' | 'blue' | 'silver' | 'white' | 'black'
      shape: 'rect', // 'rect' | 'pill'
      label: 'paypal', // 'paypal' | 'checkout' | 'buynow' | 'pay' | ...
      height: 45,
      tagline: false,
    },
    createOrder: () => Promise.resolve('ORDER_ID'),
  })
  .render('#paypal-button-container');
```

### Multiple layouts

- **Stacked (vertical):** better on narrow screens.
- **Horizontal:** side-by-side when width allows; test wrapping.

```javascript
style: { layout: 'vertical', color: 'gold', shape: 'pill' }
```

## JS SDK v6 — CSS classes on web components

v6 exposes components such as `<paypal-button>`. Apply classes defined by PayPal’s v6 theming (refer to current **Customize** docs for class names).

```html
<paypal-button
  id="paypal-button"
  type="pay"
  class="paypal-gold paypal-shape-rect">
</paypal-button>
```

```css
.buttons-container {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  max-width: 400px;
  margin: 0 auto;
}

@media (min-width: 480px) {
  .buttons-container--horizontal {
    flex-direction: row;
    flex-wrap: wrap;
  }
}
```

Exact class names (`paypal-gold`, etc.) should match the versioned documentation for **JS SDK v6**.

## Responsive design tips

- Reserve **minimum height** for the button container to avoid layout shift.
- Use **flex** or **grid** with gap for multiple funding sources.
- On small viewports, prefer **full-width** buttons (`width: 100%` on container).
- Test with **zoom** and large font settings.

## Common issues

| Issue | Resolution |
|-------|------------|
| Styles not applied (v6) | Use supported component classes; avoid overriding iframe internals |
| Clipped buttons | Increase container min-height; check parent `overflow` |

## Best practices

- Match your site’s **spacing and typography** around buttons, not inside secured iframes you do not control (v5).
- Follow **accessibility**: visible focus, sufficient contrast, descriptive labels on the page.
- Test **sandbox** and **production** themes if they differ.
