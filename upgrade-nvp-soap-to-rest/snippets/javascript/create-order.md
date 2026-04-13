#### Create an order

```js
async function createOrder() {
  try {
        const payload = {
            intent: "CAPTURE", // Legacy equivalents — NVP: PAYMENTREQUEST_n_PAYMENTACTION or PAYMENTACTION ; SOAP: PaymentDetails.PaymentAction
            purchase_units: [
                {
                    amount: {
                        currency_code: "USD", // Legacy equivalents — NVP: CURRENCYCODE ; SOAP: PaymentDetails.OrderTotal.currencyID
                        value: "10.00", // Legacy equivalents — NVP: AMT ; SOAP: PaymentDetails.OrderTotal
                    },
                },
            ],
            payment_source: {
                paypal: {
                    experience_context: {
                        return_url: "http://localhost:3000/scenario/complete", // Legacy equivalents — NVP: RETURNURL ; SOAP: ReturnURL
                        cancel_url: "http://localhost:3000/scenario/cancel", // Legacy equivalents — NVP: CANCELURL ; SOAP: CancelURL
                    }
                }
            },
        };
        const accessToken = await getPayPalAccessToken();
        const res = await axios.post(`${baseUrl}/v2/checkout/orders`, payload, {
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${accessToken}`,
              // Optional but recommended for idempotency:
              "PayPal-Request-Id": crypto.randomUUID(),
            },
        });
        const orderId = res.data.id;
        // Approval URL is returned as "payer-action" if "payment_source" was mentioned during order creation.
        // If "payment_source" was not mentioned, it is returned as "approve" in the HATEOAS links.
        const approvalUrl = res.data.links?.find((l) => l.rel === "approve" || l.rel === "payer-action")?.href || null;
        return { orderId, approvalUrl };
  } catch (err) { 
        // Log the correlation id (debug_id) in case of an error.
        console.log(`Error debug id: ${err?.response?.data?.debug_id}`);
        throw err;
  }
}
```