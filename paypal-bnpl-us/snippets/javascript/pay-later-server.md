# Pay Later Server-Side (Node.js/Express) — US

Server-side order creation and capture for Pay Later. No special order payload is needed — standard Orders API v2 works for Pay Later.

Source: https://docs.paypal.ai/reference/api/rest/orders/create-order

## Shared: OAuth access token

```javascript
import axios from "axios";

const PAYPAL_BASE_URL =
  process.env.PAYPAL_ENVIRONMENT === "production"
    ? "https://api-m.paypal.com"
    : "https://api-m.sandbox.paypal.com";

async function getPayPalAccessToken() {
  const auth = Buffer.from(
    `${process.env.PAYPAL_CLIENT_ID}:${process.env.PAYPAL_CLIENT_SECRET}`
  ).toString("base64");

  const { data } = await axios.post(
    `${PAYPAL_BASE_URL}/v1/oauth2/token`,
    "grant_type=client_credentials",
    {
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
    }
  );
  return data.access_token;
}
```

## Express — Create Order

```javascript
import express from "express";
import crypto from "node:crypto";

const app = express();
app.use(express.json());

app.post("/paypal-api/checkout/orders/create", async (req, res) => {
  try {
    const { amount, currency_code = "USD" } = req.body;

    const value = parseFloat(amount);
    if (!Number.isFinite(value) || value <= 0) {
      return res.status(400).json({ error: "INVALID_AMOUNT" });
    }

    const accessToken = await getPayPalAccessToken();

    const payload = {
      intent: "CAPTURE",
      purchase_units: [
        {
          amount: {
            currency_code,
            value: value.toFixed(2),
          },
        },
      ],
    };

    const response = await axios.post(
      `${PAYPAL_BASE_URL}/v2/checkout/orders`,
      payload,
      {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
          "PayPal-Request-Id": crypto.randomUUID(),
        },
      }
    );

    res.json({
      id: response.data.id,
      status: response.data.status,
      links: response.data.links,
    });
  } catch (error) {
    const debugId = error.response?.headers?.["paypal-debug-id"];
    console.error("Create order failed", error.response?.data, debugId);
    res.status(error.response?.status || 500).json({
      error: "ORDER_CREATE_FAILED",
      debugId,
      details: error.response?.data?.details,
    });
  }
});
```

## Express — Capture Order

```javascript
app.post("/paypal-api/checkout/orders/:orderId/capture", async (req, res) => {
  try {
    const { orderId } = req.params;
    const accessToken = await getPayPalAccessToken();

    const response = await axios.post(
      `${PAYPAL_BASE_URL}/v2/checkout/orders/${orderId}/capture`,
      {},
      {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
          "PayPal-Request-Id": crypto.randomUUID(),
        },
      }
    );

    res.json(response.data);
  } catch (error) {
    const debugId = error.response?.headers?.["paypal-debug-id"];
    console.error("Capture failed", error.response?.data, debugId);
    res.status(error.response?.status || 500).json({
      error: "CAPTURE_FAILED",
      debugId,
      details: error.response?.data?.details,
    });
  }
});
```

## Express — Client Token Generation (for v6 clientToken auth)

Only needed if using `clientToken` authentication instead of `clientId`.

Source: https://docs.paypal.ai/developer/how-to/sdk/js/v6/configuration#option-b-client-token

```javascript
app.get("/paypal-api/auth/browser-safe-client-token", async (req, res) => {
  try {
    const auth = Buffer.from(
      `${process.env.PAYPAL_CLIENT_ID}:${process.env.PAYPAL_CLIENT_SECRET}`
    ).toString("base64");

    const { data } = await axios.post(
      `${PAYPAL_BASE_URL}/v1/oauth2/token`,
      "grant_type=client_credentials&response_type=client_token",
      {
        headers: {
          Authorization: `Basic ${auth}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
      }
    );

    res.json({ client_token: data.access_token });
  } catch (error) {
    console.error("Token generation failed", error.response?.data);
    res.status(500).json({ error: "TOKEN_GENERATION_FAILED" });
  }
});
```

## Start the server

```javascript
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
```

## Key Points

- No special API fields for Pay Later — standard `POST /v2/checkout/orders` works
- PayPal determines which Pay Later product (Pay in 4 vs Pay Monthly) based on buyer + amount
- Use `intent: CAPTURE` for Pay Later transactions
- US Pay in 4 amount range: $30–$1,500; Pay Monthly: $49–$10,000
- Never expose `PAYPAL_CLIENT_SECRET` in client-side code
- Use `PayPal-Request-Id` for idempotent retries
- Log `paypal-debug-id` from response headers for troubleshooting
