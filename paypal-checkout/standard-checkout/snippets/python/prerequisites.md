# Prerequisites — Python (PayPal Standard Checkout)

This document lists runtime requirements, dependencies, environment configuration, and a suggested project layout for Flask-based Standard Checkout integrations.

## Runtime

- **Python**: 3.9 or newer (3.11+ recommended for security and performance).
- **Package manager**: `pip` (ships with Python) or your preferred lockfile workflow (`pip-tools`, Poetry, etc.).

## Dependencies

Install core libraries used across the snippets:

```bash
pip install flask requests python-dotenv
```

| Package | Purpose |
|--------|---------|
| `flask` | HTTP server, routes, JSON responses, templates |
| `requests` | Calls to PayPal REST APIs with timeouts and error handling |
| `python-dotenv` | Load `.env` in development (never commit secrets) |

Optional but common in production:

```bash
pip install gunicorn
```

## Environment variables

Load with `os.environ` (and optionally `python-dotenv` in dev). Never log secret values.

| Variable | Required | Description |
|----------|----------|-------------|
| `PAYPAL_CLIENT_ID` | Yes | REST app Client ID from the PayPal Developer Dashboard |
| `PAYPAL_CLIENT_SECRET` | Yes | REST app secret |
| `PAYPAL_ENVIRONMENT` | Yes | `sandbox` or `production` (selects API base URL) |

Example `.env` (local development only):

```env
PAYPAL_CLIENT_ID=your_sandbox_client_id
PAYPAL_CLIENT_SECRET=your_sandbox_secret
PAYPAL_ENVIRONMENT=sandbox
```

## PayPal REST API base URLs

Use these hosts for server-to-server calls:

| Environment | Base URL |
|-------------|----------|
| Sandbox | `https://api-m.sandbox.paypal.com` |
| Production | `https://api-m.paypal.com` |

Derive in code:

```python
import os

def paypal_api_base() -> str:
    env = os.environ.get("PAYPAL_ENVIRONMENT", "sandbox").lower()
    if env == "production":
        return "https://api-m.paypal.com"
    return "https://api-m.sandbox.paypal.com"
```

## Suggested directory structure

A minimal Flask layout that matches the snippet routes:

```
your_project/
├── .env                 # local only; gitignored
├── app.py               # Flask app factory or main module
├── config.py            # optional: centralize env validation
├── requirements.txt
├── templates/
│   └── checkout.html    # Jinja2 + PayPal JS SDK
└── static/
    └── js/              # optional client scripts
```

## Security checklist

- Store `PAYPAL_CLIENT_SECRET` only on the server; never expose it to the browser.
- Use HTTPS in production for every route that handles tokens, orders, or webhooks.
- Restrict CORS to known origins if the checkout page is on a different domain.
- Rotate credentials if they are leaked; use separate sandbox vs production apps.

## Best practices

- Fail fast at startup if required env vars are missing (avoid silent sandbox/production mix-ups).
- Use a single helper for `paypal_api_base()` and OAuth so all snippets share one configuration source.
- Pin dependency versions in `requirements.txt` for reproducible builds.

## Common issues

- **Wrong environment**: Calling production URLs with sandbox credentials (or vice versa) yields `401`/`INVALID_CLIENT`.
- **Missing `.env` in production**: Use your platform’s secret manager; `load_dotenv()` is for local dev only.
- **Python 3.8 EOL**: Prefer 3.9+ as specified for TLS and typing support used in the examples.
