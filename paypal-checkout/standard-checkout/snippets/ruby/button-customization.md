# Button Customization — JavaScript SDK (Standard Checkout)

Smart Payment Buttons support **layout**, **color**, **shape**, **label**, **height**, and **tagline** options (v5). For **v6**, styling is applied via **web component attributes** and CSS variables as documented in current PayPal references.

Credentials stay server-side; customization is **client-side** only.

---

## JS SDK v5 — `paypal.Buttons` style

```javascript
paypal
  .Buttons({
    style: {
      layout: 'vertical', // 'vertical' | 'horizontal'
      color: 'gold', // 'gold' | 'blue' | 'silver' | 'white' | 'black'
      shape: 'rect', // 'rect' | 'pill'
      label: 'paypal', // 'paypal' | 'checkout' | 'buynow' | 'pay' | 'installment'
      height: 45, // 25–55
      tagline: false,
    },
    createOrder: () => { /* ... */ },
    onApprove: () => { /* ... */ },
  })
  .render('#paypal-button-container');
```

### Disable specific funding sources

```javascript
// In script URL:
// &disable-funding=credit,card

paypal.Buttons({
  fundingSource: paypal.FUNDING.PAYPAL,
  // ...
});
```

---

## JS SDK v6 — web components (example)

Attributes vary by component version; consult the current v6 reference for `paypal-button`:

```html
<paypal-button
  type="pay"
  color="gold"
  shape="rect"
  id="main-paypal-button"
></paypal-button>
```

You may also use **CSS variables** (names depend on PayPal doc version), e.g. theming within the shadow DOM where supported.

---

## Sinatra — inject options from server

Pass safe, non-secret display options from Ruby:

```ruby
# app.rb
get "/checkout" do
  @button_style = {
    layout: "vertical",
    color: "blue",
    shape: "pill",
    label: "checkout",
    height: 48,
    tagline: false
  }
  erb :checkout
end
```

```erb
<script>
  window.__PAYPAL_BUTTON_STYLE = <%= @button_style.to_json %>;
</script>
<script>
  paypal.Buttons({
    style: window.__PAYPAL_BUTTON_STYLE,
    createOrder: () => { /* ... */ },
    onApprove: () => { /* ... */ },
  }).render('#paypal-button-container');
</script>
```

---

## Rails

```erb
<%= javascript_tag nonce: true do %>
  window.__PAYPAL_BUTTON_STYLE = <%= raw(button_style_json) %>;
<% end %>
```

Use `raw` only with a **sanitized** hash (no user HTML).

---

## Best practices

- Match your site’s contrast and spacing; test **mobile** widths.
- Follow PayPal [brand guidelines](https://developer.paypal.com/docs/checkout/standard/customize/) for allowed color combinations.
- Do not obscure the PayPal logo or misrepresent payment methods.
