# Prerequisites — Expanded Checkout (Python / Flask)

Expanded Checkout adds **custom Card Fields**, **3D Secure**, **Fastlane**, **Apple Pay**, **Google Pay**, and **card vaulting** on top of Standard Checkout. Server-side code uses **Flask**, **`requests`**, and environment-based configuration.

## Runtime and packages

| Requirement | Version / notes |
|-------------|-----------------|
| **Python** | **3.9+** (3.10+ recommended) |
| **Flask** | Current stable 2.x or 3.x |
| **requests** | HTTP client for PayPal REST APIs |
| **python-dotenv** | Load `PAYPAL_*` from `.env` in development |

Install (example):

```bash
pip install flask requests python-dotenv
```

## Environment variables

```bash
PAYPAL_CLIENT_ID=your_rest_app_client_id
PAYPAL_CLIENT_SECRET=your_rest_app_secret
PAYPAL_ENVIRONMENT=sandbox   # or production
PAYPAL_WEBHOOK_ID=your_webhook_id   # for webhook verification
```

Load in Flask (optional pattern):

```python
from dotenv import load_dotenv
load_dotenv()
```

## PayPal API base URLs

| Environment | Base URL |
|-------------|----------|
| Sandbox | `https://api-m.sandbox.paypal.com` |
| Production | `https://api-m.paypal.com` |

## Eligibility (required reading)

Expanded Checkout is **not available to all merchants by default**. Confirm your account, regions, and currencies before building:

- **Eligibility**: https://developer.paypal.com/docs/checkout/advanced/eligibility/

Typical constraints include supported **countries** and **currencies** for Advanced Checkout, Card Fields, wallets, and Fastlane. Align your test plan with sandbox eligibility for your app.

## Payload conventions (critical)

- Use **`payment_source.paypal.experience_context`** for PayPal wallet flows — **not** legacy top-level `application_context` on the order.
- Use **`payment_source.card`** for card payments (Card Fields / server-side card source), including **`experience_context`** on the card object when return/cancel URLs are required (for example 3D Secure redirects).

## Security

- Never expose **`PAYPAL_CLIENT_SECRET`** to the browser or static assets.
- Serve checkout and webhooks over **HTTPS** in production.
- Card data stays in PayPal-hosted Card Fields; your server does not receive raw PAN/CVV.

## Related snippets

- `client-token-generation.md` — browser-safe client token for JS SDK v6
- `sdk-initialization.md` — v5/v6 + Card Fields in Jinja2 templates
- `create-order.md` / `capture-order.md` — Orders API v2 with card-specific fields
