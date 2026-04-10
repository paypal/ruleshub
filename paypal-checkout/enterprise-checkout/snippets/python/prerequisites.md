# Prerequisites — Enterprise Checkout (Python)

Enterprise Checkout has **two pillars**:

1. **Braintree Direct** — server uses the **`braintree`** pip package with **Flask** for client tokens, transactions, vault, 3DS, and webhooks.
2. **Multiparty / Platform** — server uses **`requests`** against **PayPal REST APIs** for seller onboarding, orders with **platform fees**, capture, and refunds.

## Runtime and packages

| Requirement | Version / notes |
|-------------|-----------------|
| **Python** | **3.9+** (3.10+ recommended) |
| **Flask** | Current stable 2.x or 3.x |
| **braintree** | Braintree server SDK (Braintree Direct) |
| **requests** | HTTP client for PayPal REST (multiparty, webhooks, OAuth) |
| **python-dotenv** | Load credentials from `.env` in development |

Install:

```bash
pip install braintree flask requests python-dotenv
```

(`braintree` is the Braintree server SDK: `pip install braintree`.)

## Environment variables — Braintree Direct

```bash
BRAINTREE_MERCHANT_ID=your_merchant_id
BRAINTREE_PUBLIC_KEY=your_public_key
BRAINTREE_PRIVATE_KEY=your_private_key
BRAINTREE_ENVIRONMENT=sandbox   # or production
```

Optional: **`BRAINTREE_WEBHOOK_ID`** or store webhook validation keys per Braintree Control Panel.

## Environment variables — PayPal REST (multiparty, webhooks, Cart API)

```bash
PAYPAL_CLIENT_ID=your_rest_app_client_id
PAYPAL_CLIENT_SECRET=your_rest_app_secret
PAYPAL_ENVIRONMENT=sandbox   # or production
PAYPAL_WEBHOOK_ID=your_webhook_id   # for verify-webhook-signature
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

## Payload conventions (multiparty — critical)

- Use **`payment_source.paypal.experience_context`** for PayPal wallet flows on orders — **not** legacy top-level **`application_context`**.
- Partner calls that act on behalf of a seller require **`PayPal-Auth-Assertion`** (see `multiparty-create-order.md`).

## Security

- Never expose **`BRAINTREE_PRIVATE_KEY`**, **`PAYPAL_CLIENT_SECRET`**, or raw webhooks secrets to the browser.
- Serve checkout and webhooks over **HTTPS** in production.

## Related snippets

| Braintree Direct | Multiparty / Platform |
|------------------|------------------------|
| `braintree-client-token.md` | `seller-onboarding.md` |
| `drop-in-ui-integration.md` | `multiparty-create-order.md` |
| `hosted-fields-integration.md` | `multiparty-capture.md` |
| `braintree-transaction.md` | `agentic-commerce.md` |
| `braintree-vault.md` | `error-handling.md` |
| `braintree-3d-secure.md` | `webhooks.md` |
